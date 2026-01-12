import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/prompts/[id] - Get prompt by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const prompt = await prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompt' },
      { status: 500 }
    );
  }
}

// PATCH /api/prompts/[id] - Update prompt
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, description, isActive } = body;

    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error updating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

// DELETE /api/prompts/[id] - Delete prompt
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const prompt = await prisma.prompt.findUnique({
      where: { id },
    });

    if (prompt?.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system prompts' },
        { status: 400 }
      );
    }

    await prisma.prompt.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}
