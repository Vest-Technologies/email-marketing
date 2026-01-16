import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES } from '@/lib/constants';

// POST /api/pipeline/batch-approve - Approve multiple emails at once
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyIds } = body as { companyIds: string[] };

    if (!companyIds || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company IDs provided' },
        { status: 400 }
      );
    }

    // Get all companies in pending_review state with emails
    const companies = await prisma.company.findMany({
      where: {
        id: { in: companyIds },
        pipelineState: PIPELINE_STATES.PENDING_REVIEW,
      },
      include: {
        email: true,
      },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        approved: 0,
        failed: 0,
        errors: [],
        message: 'No companies found in pending_review state',
      });
    }

    const results = {
      approved: 0,
      failed: 0,
      errors: [] as Array<{ companyId: string; companyName: string; error: string }>,
    };

    for (const company of companies) {
      try {
        if (!company.email) {
          results.failed++;
          results.errors.push({
            companyId: company.id,
            companyName: company.name,
            error: 'No email found',
          });
          continue;
        }

        // Set final content (use edited if available, otherwise original)
        const finalSubject = company.email.editedSubject || company.email.subject;
        const finalBody = company.email.editedBody || company.email.body;

        // Update email
        await prisma.email.update({
          where: { id: company.email.id },
          data: {
            finalSubject,
            finalBody,
            approvedAt: new Date(),
          },
        });

        // Transition company to approved_to_send
        const result = await transitionState(
          company.id,
          PIPELINE_STATES.APPROVED_TO_SEND
        );

        if (!result.success) {
          results.failed++;
          results.errors.push({
            companyId: company.id,
            companyName: company.name,
            error: result.error || 'Transition failed',
          });
          continue;
        }

        // Create audit log
        await prisma.auditLog.create({
          data: {
            entityType: 'email',
            entityId: company.email.id,
            action: 'email_approved',
            metadata: { batchOperation: true },
          },
        });

        results.approved++;
      } catch (error) {
        console.error(`Error approving email for company ${company.id}:`, error);
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
    console.error('Error in batch approve:', error);
    return NextResponse.json(
      { error: 'Failed to batch approve emails' },
      { status: 500 }
    );
  }
}
