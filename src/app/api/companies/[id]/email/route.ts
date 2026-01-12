import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES } from '@/lib/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/companies/[id]/email - Delete email and reset company to pending_generation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const company = await prisma.company.findUnique({
      where: { id },
      include: { email: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!company.email) {
      return NextResponse.json(
        { error: 'No email found for this company' },
        { status: 404 }
      );
    }

    // Delete email and reset company state
    await prisma.$transaction([
      prisma.email.delete({
        where: { id: company.email.id },
      }),
      prisma.company.update({
        where: { id },
        data: { pipelineState: PIPELINE_STATES.PENDING_GENERATION },
      }),
      prisma.auditLog.create({
        data: {
          entityType: 'email',
          entityId: id,
          action: 'email_deleted',
          fromState: company.pipelineState,
          toState: PIPELINE_STATES.PENDING_GENERATION,
          metadata: {
            emailId: company.email.id,
          },
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting email:', error);
    return NextResponse.json(
      { error: 'Failed to delete email' },
      { status: 500 }
    );
  }
}
