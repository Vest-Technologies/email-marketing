import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { generateEmailWithRetry } from '@/lib/services/gemini';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES, DEFAULT_SYSTEM_PROMPT, GEMINI_MODEL } from '@/lib/constants';

// POST /api/pipeline/batch-retry - Retry email generation for selected companies
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyIds, customPrompt } = body as {
      companyIds: string[];
      customPrompt?: string;
    };

    if (!companyIds || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company IDs provided' },
        { status: 400 }
      );
    }

    // Get companies in email_not_generated state with contact info
    const companies = await prisma.company.findMany({
      where: {
        id: { in: companyIds },
        pipelineState: PIPELINE_STATES.EMAIL_NOT_GENERATED,
        targetContactEmail: { not: null }, // Only retry if we have contact email
      },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        failed: 0,
        errors: [],
        message: 'No companies with contacts found to retry',
      });
    }

    const results = {
      generated: 0,
      failed: 0,
      errors: [] as Array<{ companyId: string; companyName: string; error: string }>,
    };

    const promptToUse = customPrompt || DEFAULT_SYSTEM_PROMPT;

    for (const company of companies) {
      try {
        if (!company.targetContactEmail) {
          results.failed++;
          results.errors.push({
            companyId: company.id,
            companyName: company.name,
            error: 'No contact email found',
          });
          continue;
        }

        // Generate email with Gemini
        const emailResult = await generateEmailWithRetry(
          company.name,
          company.domain,
          promptToUse,
          company.website || undefined,
          {
            firstName: company.targetContactFirstName || '',
            lastName: company.targetContactLastName || undefined,
            title: company.targetContactTitle || undefined,
          }
        );

        if (!emailResult.success) {
          results.failed++;
          results.errors.push({
            companyId: company.id,
            companyName: company.name,
            error: emailResult.error || 'Email generation failed',
          });
          continue;
        }

        // Delete any existing email
        await prisma.email.deleteMany({
          where: { companyId: company.id },
        });

        // Save new email
        await prisma.email.create({
          data: {
            companyId: company.id,
            subject: emailResult.subject!,
            body: emailResult.body!,
            promptUsed: promptToUse,
            geminiModelUsed: GEMINI_MODEL,
          },
        });

        // Clear not generated reason and transition to pending_review
        await prisma.company.update({
          where: { id: company.id },
          data: { notGeneratedReason: Prisma.JsonNull },
        });

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
              batchRetry: true,
            },
          },
        });

        results.generated++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error retrying email for company ${company.id}:`, error);
        results.failed++;
        results.errors.push({
          companyId: company.id,
          companyName: company.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error in batch retry:', error);
    return NextResponse.json(
      { error: 'Failed to batch retry email generation' },
      { status: 500 }
    );
  }
}
