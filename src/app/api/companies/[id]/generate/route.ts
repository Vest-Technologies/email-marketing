import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateEmailWithRetry } from '@/lib/services/gemini';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES, DEFAULT_SYSTEM_PROMPT, GEMINI_MODEL } from '@/lib/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/companies/[id]/generate - Generate email for company
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { customPrompt } = body;
    
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        email: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check if we have a target contact
    if (!company.targetContactFirstName) {
      return NextResponse.json({
        success: false,
        error: 'No target contact found. Please click "Find Contact" first to find a person with target titles at this company.',
      }, { status: 400 });
    }

    // Warn if no email but allow generation
    if (!company.targetContactEmail) {
      console.warn(`Company ${company.name} has contact ${company.targetContactFirstName} but no email. Email generation will proceed but cannot be sent.`);
    }

    // Determine prompt to use
    const promptToUse = customPrompt || DEFAULT_SYSTEM_PROMPT;

    // Generate email with Gemini - include target contact info
    const result = await generateEmailWithRetry(
      company.name, 
      company.domain, 
      promptToUse,
      company.website || undefined,
      {
        firstName: company.targetContactFirstName,
        lastName: company.targetContactLastName || undefined,
        title: company.targetContactTitle || undefined,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 422 }
      );
    }

    // Save or update email
    if (company.email) {
      await prisma.email.update({
        where: { id: company.email.id },
        data: {
          subject: result.subject!,
          body: result.body!,
          promptUsed: promptToUse,
          generatedAt: new Date(),
          geminiModelUsed: GEMINI_MODEL,
          // Reset review fields for regeneration
          editedSubject: null,
          editedBody: null,
          reviewedAt: null,
          approvedAt: null,
          finalSubject: null,
          finalBody: null,
        },
      });
    } else {
      await prisma.email.create({
        data: {
          companyId: id,
          subject: result.subject!,
          body: result.body!,
          promptUsed: promptToUse,
          geminiModelUsed: GEMINI_MODEL,
        },
      });
    }

    // Transition to pending_review
    await transitionState(id, PIPELINE_STATES.PENDING_REVIEW);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'email',
        entityId: id,
        action: 'email_generated',
        metadata: {
          subject: result.subject,
          bodyLength: result.body?.length,
          targetContact: `${company.targetContactFirstName} ${company.targetContactLastName}`,
        },
      },
    });

    return NextResponse.json({
      success: true,
      email: {
        subject: result.subject,
        body: result.body,
      },
    });
  } catch (error) {
    console.error('Error generating email:', error);
    return NextResponse.json(
      { error: 'Failed to generate email' },
      { status: 500 }
    );
  }
}
