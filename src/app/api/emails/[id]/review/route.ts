import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES } from '@/lib/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/emails/[id]/review - Get email for review
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (error) {
    console.error('Error fetching email for review:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email' },
      { status: 500 }
    );
  }
}

// POST /api/emails/[id]/review - Submit review edits
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { editedSubject, editedBody, reviewedBy, recipientEmail } = body;

    const email = await prisma.email.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Validate inputs
    if (!editedSubject?.trim() || !editedBody?.trim()) {
      return NextResponse.json(
        { error: 'Subject and body are required' },
        { status: 400 }
      );
    }

    // Update email with review edits
    await prisma.email.update({
      where: { id },
      data: {
        editedSubject: editedSubject.trim(),
        editedBody: editedBody.trim(),
        // Also update finalSubject/finalBody for approved emails
        ...(email.company.pipelineState === 'approved_to_send' && {
          finalSubject: editedSubject.trim(),
          finalBody: editedBody.trim(),
        }),
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    // Update recipient email on company if provided
    if (recipientEmail?.trim()) {
      await prisma.company.update({
        where: { id: email.companyId },
        data: {
          targetContactEmail: recipientEmail.trim(),
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'email',
        entityId: id,
        action: 'email_reviewed',
        metadata: {
          editedSubject: editedSubject !== email.subject,
          editedBody: editedBody !== email.body,
          recipientEmailChanged: !!recipientEmail,
          reviewedBy,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}
