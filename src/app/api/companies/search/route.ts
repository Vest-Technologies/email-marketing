import { NextRequest, NextResponse } from 'next/server';
import { searchCompanies, type ApolloFilters } from '@/lib/services/apollo';

// POST /api/companies/search - Search companies via Apollo
export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.APOLLO_API_KEY || process.env.APOLLO_API_KEY === 'your_apollo_api_key_here') {
      return NextResponse.json(
        { error: 'Apollo API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { filters, page = 1, perPage = 25 } = body;

    // Log received filters
    console.log('[API] Received search request:', JSON.stringify({
      filters,
      page,
      perPage,
    }, null, 2));

    // Validate and clean filters - remove empty arrays and undefined values
    const apolloFilters: ApolloFilters = {
      locations: filters?.locations && filters.locations.length > 0 ? filters.locations : undefined,
      employeeCountMin: filters?.employeeCountMin !== undefined && filters.employeeCountMin !== null 
        ? Number(filters.employeeCountMin) 
        : undefined,
      employeeCountMax: filters?.employeeCountMax !== undefined && filters.employeeCountMax !== null 
        ? Number(filters.employeeCountMax) 
        : undefined,
      industries: filters?.industries && filters.industries.length > 0 ? filters.industries : undefined,
      keywords: filters?.keywords && filters.keywords.length > 0 ? filters.keywords : undefined,
    };

    // Log processed filters
    console.log('[API] Processed Apollo filters:', JSON.stringify(apolloFilters, null, 2));

    const result = await searchCompanies(apolloFilters, page, perPage);

    return NextResponse.json({
      companies: result.companies,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error searching companies:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search companies' },
      { status: 500 }
    );
  }
}
