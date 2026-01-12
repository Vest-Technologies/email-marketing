import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/db/clear - Clear all data from database
export async function POST(request: NextRequest) {
  try {
    // Delete all data in correct order (respecting foreign key constraints)
    await prisma.$transaction([
      // Delete emails first (has foreign key to companies)
      prisma.email.deleteMany({}),
      // Delete audit logs
      prisma.auditLog.deleteMany({}),
      // Delete companies
      prisma.company.deleteMany({}),
      // Delete prompts (if any)
      prisma.prompt.deleteMany({}),
      // Delete target titles (if any)
      prisma.targetTitle.deleteMany({}),
    ]);

    return NextResponse.json({ 
      success: true,
      message: 'Database cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json(
      { error: 'Failed to clear database' },
      { status: 500 }
    );
  }
}
