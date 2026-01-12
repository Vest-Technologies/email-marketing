import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transitionState } from '@/lib/services/pipeline';
import { PIPELINE_STATES } from '@/lib/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/companies/[id] - Get company details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        email: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    );
  }
}

// PATCH /api/companies/[id] - Update company
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { pipelineState, notGeneratedReason } = body;
    
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // If changing pipeline state, use transitionState for validation
    if (pipelineState && pipelineState !== company.pipelineState) {
      const result = await transitionState(
        id,
        pipelineState as typeof PIPELINE_STATES[keyof typeof PIPELINE_STATES]
      );
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
    }

    // Update other fields
    const updateData: any = {};
    if (notGeneratedReason !== undefined) {
      updateData.notGeneratedReason = notGeneratedReason;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.company.update({
        where: { id },
        data: updateData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id] - Delete company
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    await prisma.company.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    );
  }
}
