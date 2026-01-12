import { NextRequest, NextResponse } from 'next/server';
import { getCompaniesByState } from '@/lib/services/pipeline';
import { PIPELINE_STATES, type PipelineState } from '@/lib/constants';

// GET /api/pipeline/companies - Get companies by pipeline state
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') as PipelineState;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!state || !Object.values(PIPELINE_STATES).includes(state)) {
      return NextResponse.json(
        { error: 'Invalid or missing state parameter' },
        { status: 400 }
      );
    }

    const result = await getCompaniesByState(state, limit, offset);

    return NextResponse.json({
      companies: result.companies,
      total: result.total,
      state,
    });
  } catch (error) {
    console.error('Error fetching companies by state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}
