import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/constants';

const ACTIVE_PROMPT_NAME = 'active_prompt';

// GET /api/prompts/active - Get the active prompt
export async function GET() {
  try {
    let prompt = await prisma.prompt.findUnique({
      where: { name: ACTIVE_PROMPT_NAME },
    });

    // Create default if not exists
    if (!prompt) {
      prompt = await prisma.prompt.create({
        data: {
          name: ACTIVE_PROMPT_NAME,
          content: DEFAULT_SYSTEM_PROMPT,
          description: 'Active prompt used for email generation',
          isSystem: false,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error fetching active prompt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active prompt' },
      { status: 500 }
    );
  }
}

// PUT /api/prompts/active - Update the active prompt
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Upsert the active prompt
    const prompt = await prisma.prompt.upsert({
      where: { name: ACTIVE_PROMPT_NAME },
      update: { content },
      create: {
        name: ACTIVE_PROMPT_NAME,
        content,
        description: 'Active prompt used for email generation',
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error updating active prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update active prompt' },
      { status: 500 }
    );
  }
}
