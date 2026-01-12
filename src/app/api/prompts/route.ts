import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/constants';

// GET /api/prompts - Get all prompts
export async function GET() {
  try {
    const prompts = await prisma.prompt.findMany({
      orderBy: [
        { isSystem: 'desc' },
        { isActive: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    // Include default system prompt if not in DB
    const hasSystemDefault = prompts.some((p) => p.name === 'system_default');
    if (!hasSystemDefault) {
      prompts.unshift({
        id: 'system_default',
        name: 'system_default',
        content: DEFAULT_SYSTEM_PROMPT,
        description: 'Default system prompt for email generation',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

// POST /api/prompts - Create a new prompt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, content, description } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }

    const prompt = await prisma.prompt.create({
      data: {
        name,
        content,
        description,
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}
