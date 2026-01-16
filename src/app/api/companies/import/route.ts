import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { type ApolloCompany, findBestContact } from '@/lib/services/apollo';
import { generateEmailWithRetry } from '@/lib/services/gemini';
import { transitionState, markEmailNotGenerated } from '@/lib/services/pipeline';
import { PIPELINE_STATES, DEFAULT_SYSTEM_PROMPT, GEMINI_MODEL } from '@/lib/constants';

const BATCH_SIZE = 3; // Process 3 companies at a time
const BATCH_DELAY_MS = 500; // Delay between batches

type ProcessResult = {
  imported: boolean;
  emailGenerated: boolean;
  noContact: boolean;
  error: boolean;
  company?: { id: string; name: string; state: string };
  errorDetail?: { companyName: string; error: string };
};

// Process a single company - import, find contact, generate email
async function processCompany(
  company: ApolloCompany,
  customPrompt: string | undefined
): Promise<ProcessResult> {
  const result: ProcessResult = {
    imported: false,
    emailGenerated: false,
    noContact: false,
    error: false,
  };

  try {
    // Check if company already exists (by apolloId/organization_id or domain)
    const orgId = company.organization_id || company.id;
    console.log(`[Import] Company: ${company.name}, id: ${company.id}, organization_id: ${company.organization_id}, using: ${orgId}`);

    let dbCompany;
    const existing = await prisma.company.findFirst({
      where: {
        OR: [
          { apolloId: orgId },
          { domain: company.domain || '' },
        ],
      },
    });

    if (existing) {
      // Update existing company
      dbCompany = await prisma.company.update({
        where: { id: existing.id },
        data: {
          apolloId: orgId,
        },
      });
    } else {
      // Create new company
      dbCompany = await prisma.company.create({
        data: {
          apolloId: company.organization_id || company.id,
          name: company.name,
          domain: company.domain || '',
          website: company.website_url,
          industry: company.industry,
          location: [company.city, company.state, company.country]
            .filter(Boolean)
            .join(', '),
          employeeCount: company.employee_count,
          pipelineState: 'pending_generation', // Temporary state during processing
        },
      });
    }

    // Track this organization as fetched (for future search exclusion)
    await prisma.fetchedOrganization.upsert({
      where: { apolloId: orgId },
      update: {},
      create: {
        apolloId: orgId,
        domain: company.domain || company.primary_domain,
        name: company.name,
      },
    });

    result.imported = true;

    // --- AUTO-PROCESSING: Find contact and generate email ---

    // Step 1: Find contact with target titles
    if (!dbCompany.apolloId) {
      await markEmailNotGenerated(dbCompany.id, 'no_apollo_id');
      result.noContact = true;
      result.company = { id: dbCompany.id, name: dbCompany.name, state: 'email_not_generated' };
      return result;
    }

    const bestContact = await findBestContact(
      dbCompany.name,
      dbCompany.apolloId
    );

    if (!bestContact.person) {
      // No contact found with target titles
      await markEmailNotGenerated(dbCompany.id, 'no_valid_contact_found');
      result.noContact = true;
      result.company = { id: dbCompany.id, name: dbCompany.name, state: 'email_not_generated' };
      return result;
    }

    // Step 2: Save contact to company
    await prisma.company.update({
      where: { id: dbCompany.id },
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
      // Contact found but no email
      await markEmailNotGenerated(dbCompany.id, 'contact_found_no_email');
      result.noContact = true;
      result.company = { id: dbCompany.id, name: dbCompany.name, state: 'email_not_generated' };
      return result;
    }

    // Determine prompt to use
    const promptToUse = customPrompt || DEFAULT_SYSTEM_PROMPT;

    // Generate email with Gemini
    const emailResult = await generateEmailWithRetry(
      dbCompany.name,
      dbCompany.domain,
      promptToUse,
      dbCompany.website || undefined,
      {
        firstName: bestContact.person.first_name || '',
        lastName: bestContact.person.last_name || undefined,
        title: bestContact.title || bestContact.person.title || undefined,
      }
    );

    if (!emailResult.success) {
      // Email generation failed
      await markEmailNotGenerated(dbCompany.id, `email_generation_failed: ${emailResult.error}`);
      result.error = true;
      result.errorDetail = {
        companyName: dbCompany.name,
        error: emailResult.error || 'Unknown error',
      };
      result.company = { id: dbCompany.id, name: dbCompany.name, state: 'email_not_generated' };
      return result;
    }

    // Step 4: Save email
    await prisma.email.create({
      data: {
        companyId: dbCompany.id,
        subject: emailResult.subject!,
        body: emailResult.body!,
        promptUsed: promptToUse,
        geminiModelUsed: GEMINI_MODEL,
      },
    });

    // Step 5: Transition to pending_review
    await transitionState(dbCompany.id, PIPELINE_STATES.PENDING_REVIEW);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'email',
        entityId: dbCompany.id,
        action: 'email_generated',
        metadata: {
          subject: emailResult.subject,
          bodyLength: emailResult.body?.length,
          targetContact: `${bestContact.person.first_name} ${bestContact.person.last_name || ''}`.trim(),
          autoProcessed: true,
          importedWithGeneration: true,
        },
      },
    });

    result.emailGenerated = true;
    result.company = { id: dbCompany.id, name: dbCompany.name, state: 'pending_review' };
    return result;

  } catch (error) {
    console.error(`Error processing company ${company.name}:`, error);
    result.error = true;
    result.errorDetail = {
      companyName: company.name,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    return result;
  }
}

// POST /api/companies/import - Import selected companies and auto-generate emails
// Processes companies in batches of 3 for better performance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companies, customPrompt } = body as {
      companies: ApolloCompany[];
      customPrompt?: string;
    };

    if (!companies || companies.length === 0) {
      return NextResponse.json(
        { error: 'No companies provided' },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      emailsGenerated: 0,
      noContact: 0,
      errors: 0,
      companies: [] as Array<{ id: string; name: string; state: string }>,
      errorDetails: [] as Array<{ companyName: string; error: string }>,
    };

    // Process companies in batches of BATCH_SIZE
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);

      console.log(`[Import] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(companies.length / BATCH_SIZE)} (${batch.length} companies)`);

      // Process batch concurrently
      const batchResults = await Promise.all(
        batch.map(company => processCompany(company, customPrompt))
      );

      // Aggregate results
      for (const result of batchResults) {
        if (result.imported) results.imported++;
        if (result.emailGenerated) results.emailsGenerated++;
        if (result.noContact) results.noContact++;
        if (result.error) results.errors++;
        if (result.company) results.companies.push(result.company);
        if (result.errorDetail) results.errorDetails.push(result.errorDetail);
      }

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < companies.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error importing companies:', error);
    return NextResponse.json(
      { error: 'Failed to import companies', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
