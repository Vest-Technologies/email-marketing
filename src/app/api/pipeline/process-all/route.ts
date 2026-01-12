import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findBestContact } from '@/lib/services/apollo';
import { generateEmailWithRetry } from '@/lib/services/gemini';
import { transitionState, markEmailNotGenerated } from '@/lib/services/pipeline';
import { PIPELINE_STATES, DEFAULT_SYSTEM_PROMPT, GEMINI_MODEL } from '@/lib/constants';

// POST /api/pipeline/process-all - Process all pending_generation companies
// For each company:
// 1. Find person with target titles
// 2. If found → Generate email → pending_review
// 3. If not found → email_not_generated
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customPrompt } = body;

    // Get all companies in pending_generation state
    const companies = await prisma.company.findMany({
      where: {
        pipelineState: PIPELINE_STATES.PENDING_GENERATION,
      },
      include: {
        email: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        emailsGenerated: 0,
        noContact: 0,
        errors: 0,
        message: 'No companies in pending_generation state',
      });
    }

    const results = {
      processed: 0,
      emailsGenerated: 0,
      noContact: 0,
      errors: 0,
      errorsDetails: [] as Array<{ companyId: string; companyName: string; error: string }>,
    };

    // Process each company
    for (const company of companies) {
      try {
        // Skip if already has email (shouldn't happen but safety check)
        if (company.email) {
          continue;
        }

        // Step 1: Find contact with target titles
        if (!company.apolloId) {
          await markEmailNotGenerated(company.id, 'no_apollo_id');
          results.noContact++;
          results.processed++;
          continue;
        }

        const bestContact = await findBestContact(
          company.name, 
          company.apolloId
        );

        if (!bestContact.person) {
          // No contact found with target titles
          await markEmailNotGenerated(company.id, 'no_valid_contact_found');
          results.noContact++;
          results.processed++;
          continue;
        }

        // Step 2: Save contact to company
        await prisma.company.update({
          where: { id: company.id },
          data: {
            targetContactFirstName: bestContact.person.first_name || null,
            targetContactLastName: bestContact.person.last_name || null,
            targetContactEmail: bestContact.enrichedEmail || null,
            targetContactTitle: bestContact.title || bestContact.person.title || null,
            contactFoundAt: new Date(),
          },
        });

        // Step 3: Generate email if we have contact email
        if (!bestContact.enrichedEmail) {
          // Contact found but no email - still mark as not generated
          await markEmailNotGenerated(company.id, 'contact_found_no_email');
          results.noContact++;
          results.processed++;
          continue;
        }

        // Determine prompt to use
        const promptToUse = customPrompt || DEFAULT_SYSTEM_PROMPT;

        // Generate email with Gemini
        const emailResult = await generateEmailWithRetry(
          company.name,
          company.domain,
          promptToUse,
          company.website || undefined,
          {
            firstName: bestContact.person.first_name || '',
            lastName: bestContact.person.last_name || undefined,
            title: bestContact.title || bestContact.person.title || undefined,
          }
        );

        if (!emailResult.success) {
          // Email generation failed
          await markEmailNotGenerated(company.id, `email_generation_failed: ${emailResult.error}`);
          results.errors++;
          results.errorsDetails.push({
            companyId: company.id,
            companyName: company.name,
            error: emailResult.error || 'Unknown error',
          });
          results.processed++;
          continue;
        }

        // Step 4: Save email
        await prisma.email.create({
          data: {
            companyId: company.id,
            subject: emailResult.subject!,
            body: emailResult.body!,
            promptUsed: promptToUse,
            geminiModelUsed: GEMINI_MODEL,
          },
        });

        // Step 5: Transition to pending_review
        await transitionState(company.id, PIPELINE_STATES.PENDING_REVIEW);

        // Create audit log
        await prisma.auditLog.create({
          data: {
            entityType: 'email',
            entityId: company.id,
            action: 'email_generated',
            metadata: {
              subject: emailResult.subject,
              bodyLength: emailResult.body?.length,
              targetContact: `${bestContact.person.first_name} ${bestContact.person.last_name || ''}`.trim(),
              autoProcessed: true,
            },
          },
        });

        results.emailsGenerated++;
        results.processed++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing company ${company.id} (${company.name}):`, error);
        results.errors++;
        results.errorsDetails.push({
          companyId: company.id,
          companyName: company.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        results.processed++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: companies.length,
    });
  } catch (error) {
    console.error('Error processing companies:', error);
    return NextResponse.json(
      { error: 'Failed to process companies', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
