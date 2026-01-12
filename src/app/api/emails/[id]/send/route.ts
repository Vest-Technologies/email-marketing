import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendApprovedEmail } from '@/lib/services/email-sender';
import { PIPELINE_STATES } from '@/lib/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/emails/[id]/send - Send approved email
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { recipientEmail, performedBy, senderEmail } = body;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    const email = await prisma.email.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (email.company.pipelineState !== PIPELINE_STATES.APPROVED_TO_SEND) {
      return NextResponse.json(
        { error: 'Email must be approved before sending' },
        { status: 400 }
      );
    }

    const result = await sendApprovedEmail(
      email.companyId,
      recipientEmail,
      performedBy,
      senderEmail
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
