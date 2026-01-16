import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendApprovedEmail } from '@/lib/services/email-sender';
import { PIPELINE_STATES } from '@/lib/constants';

// POST /api/pipeline/batch-send - Send emails for selected companies
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

    // Get companies in approved_to_send state with email and target contact
    const companies = await prisma.company.findMany({
      where: {
        id: { in: companyIds },
        pipelineState: PIPELINE_STATES.APPROVED_TO_SEND,
        targetContactEmail: { not: null },
      },
      include: {
        email: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        errors: [],
        message: 'No companies ready to send',
      });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as Array<{ companyId: string; companyName: string; error: string }>,
    };

    // Send email for each company
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

        if (!company.targetContactEmail) {
          results.failed++;
          results.errors.push({
            companyId: company.id,
            companyName: company.name,
            error: 'No recipient email found',
          });
          continue;
        }

        const result = await sendApprovedEmail(
          company.id,
          company.targetContactEmail,
          'system'
        );

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            companyId: company.id,
            companyName: company.name,
            error: result.error || 'Unknown error',
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error sending email for company ${company.id}:`, error);
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
    console.error('Error in batch send:', error);
    return NextResponse.json(
      { error: 'Failed to batch send emails' },
      { status: 500 }
    );
  }
}
