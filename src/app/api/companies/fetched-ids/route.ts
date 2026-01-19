import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/companies/fetched-ids - Get all fetched organization IDs
export async function GET() {
  try {
    const fetchedOrgs = await prisma.fetchedOrganization.findMany({
      select: { apolloId: true },
    });

    return NextResponse.json({
      ids: fetchedOrgs.map(o => o.apolloId),
    });
  } catch (error) {
    console.error('Error fetching organization IDs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization IDs', ids: [] },
      { status: 500 }
    );
  }
}
