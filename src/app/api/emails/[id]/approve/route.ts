import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES } from '@/lib/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/emails/[id]/approve - Approve email for sending
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { approvedBy } = body;
    
    const email = await prisma.email.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (email.company.pipelineState !== PIPELINE_STATES.PENDING_REVIEW) {
      return NextResponse.json(
        { error: 'Email must be in pending_review state to approve' },
        { status: 400 }
      );
    }

    // Set final content (use edited if available, otherwise original)
    const finalSubject = email.editedSubject || email.subject;
    const finalBody = email.editedBody || email.body;

    // Update email
    await prisma.email.update({
      where: { id },
      data: {
        finalSubject,
        finalBody,
        approvedAt: new Date(),
        approvedBy,
      },
    });

    // Transition company to approved_to_send
    const result = await transitionState(
      email.companyId,
      PIPELINE_STATES.APPROVED_TO_SEND,
      approvedBy
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'email',
        entityId: id,
        action: 'email_approved',
        metadata: { approvedBy },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error approving email:', error);
    return NextResponse.json(
      { error: 'Failed to approve email' },
      { status: 500 }
    );
  }
}
