import { NextRequest, NextResponse } from 'next/server';
import { getPipelineStats } from '@/lib/services/pipeline';

// GET /api/pipeline/stats - Get pipeline statistics
export async function GET(request: NextRequest) {
  try {
    const stats = await getPipelineStats();

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline stats' },
      { status: 500 }
    );
  }
}
