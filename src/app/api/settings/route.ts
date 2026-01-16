import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromCookies } from '@/lib/auth';

// GET /api/settings - Get application settings
export async function GET() {
  try {
    // Get logged-in user's email
    const auth = await getAuthFromCookies();
    const userEmail = auth?.email || null;

    // Get or create settings record
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      // Create default settings record with user's email as default
      settings = await prisma.settings.create({
        data: {
          id: 'default',
          senderEmail: userEmail || process.env.FROM_EMAIL || null,
          senderName: null,
        },
      });
    }

    // Include env fallback info and user email
    return NextResponse.json({
      settings,
      envFallback: {
        senderEmail: process.env.FROM_EMAIL || null,
      },
      userEmail,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update application settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderEmail, senderName, signature } = body;

    // Validate email if provided
    if (senderEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(senderEmail)) {
        return NextResponse.json(
          { error: 'Invalid sender email address format' },
          { status: 400 }
        );
      }
    }

    // Upsert settings
    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        senderEmail: senderEmail || null,
        senderName: senderName || null,
        signature: signature !== undefined ? (signature || null) : undefined,
      },
      create: {
        id: 'default',
        senderEmail: senderEmail || null,
        senderName: senderName || null,
        signature: signature || null,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
