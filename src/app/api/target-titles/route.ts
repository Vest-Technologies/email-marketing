import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TARGET_TITLES } from '@/lib/constants';

// Initialize default titles - add missing ones from TARGET_TITLES
async function initializeDefaultTitles() {
  const existingTitles = await prisma.targetTitle.findMany();
  const existingTitleSet = new Set(existingTitles.map(t => t.title));
  
  // Add any missing titles from TARGET_TITLES
  let maxPriority = existingTitles.length > 0 
    ? Math.max(...existingTitles.map(t => t.priority))
    : -1;
  
  for (let i = 0; i < TARGET_TITLES.length; i++) {
    const title = TARGET_TITLES[i];
    if (!existingTitleSet.has(title)) {
      await prisma.targetTitle.create({
        data: {
          title,
          priority: maxPriority + 1,
          isActive: true,
        },
      });
      maxPriority++;
      existingTitleSet.add(title);
    }
  }
  
  // Update priorities to match TARGET_TITLES order
  for (let i = 0; i < TARGET_TITLES.length; i++) {
    const title = TARGET_TITLES[i];
    await prisma.targetTitle.updateMany({
      where: { title },
      data: { priority: i },
    });
  }
}

// GET /api/target-titles - Get all target titles
export async function GET() {
  try {
    // Check if we have any titles, initialize if empty
    const existingCount = await prisma.targetTitle.count();
    if (existingCount === 0) {
      await initializeDefaultTitles();
    }

    const titles = await prisma.targetTitle.findMany({
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json({ titles });
  } catch (error) {
    console.error('Error fetching titles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch titles', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/target-titles - Add a new title
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Get max priority
    const maxPriority = await prisma.targetTitle.aggregate({
      _max: { priority: true },
    });

    const newTitle = await prisma.targetTitle.create({
      data: {
        title: title.trim(),
        priority: (maxPriority._max.priority || 0) + 1,
        isActive: true,
      },
    });

    return NextResponse.json({ title: newTitle }, { status: 201 });
  } catch (error) {
    console.error('Error adding title:', error);
    
    // Check for unique constraint
    if (error instanceof Error && error.message.includes('Unique')) {
      return NextResponse.json(
        { error: 'This title already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to add title' },
      { status: 500 }
    );
  }
}

// DELETE /api/target-titles - Delete titles by IDs
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs are required' },
        { status: 400 }
      );
    }

    await prisma.targetTitle.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Error deleting titles:', error);
    return NextResponse.json(
      { error: 'Failed to delete titles' },
      { status: 500 }
    );
  }
}
