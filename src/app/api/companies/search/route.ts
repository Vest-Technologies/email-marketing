import { NextRequest, NextResponse } from 'next/server';
import { searchCompanies, type ApolloFilters, type ApolloCompany } from '@/lib/services/apollo';
import prisma from '@/lib/prisma';

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

    // Get already fetched organization IDs
    const fetchedOrgs = await prisma.fetchedOrganization.findMany({
      select: { apolloId: true },
    });
    const fetchedIds = new Set(fetchedOrgs.map(org => org.apolloId));

    // Fetch companies and filter out already-fetched ones
    // If all companies on current page are filtered, auto-advance to next page
    let currentPage = page;
    let filteredCompanies: ApolloCompany[] = [];
    let pagination = null;
    const maxPagesToTry = 10; // Limit to prevent infinite loops
    let pagesTriedCount = 0;

    while (pagesTriedCount < maxPagesToTry) {
      const result = await searchCompanies(apolloFilters, currentPage, perPage);
      pagination = result.pagination;

      // Filter out already-fetched companies
      filteredCompanies = result.companies.filter(company => {
        const orgId = company.organization_id || company.id;
        return !fetchedIds.has(orgId);
      });

      // If we have companies after filtering, or no more pages, stop
      if (filteredCompanies.length > 0 || !pagination || currentPage >= (pagination.total_pages || 1)) {
        break;
      }

      // All companies on this page were already fetched, try next page
      console.log(`[API] Page ${currentPage} had no new companies after filtering, trying page ${currentPage + 1}`);
      currentPage++;
      pagesTriedCount++;
    }

    // Adjust pagination to reflect the effective page we're returning
    const adjustedPagination = pagination ? {
      ...pagination,
      page: currentPage,
    } : null;

    console.log(`[API] Returning ${filteredCompanies.length} companies from page ${currentPage}`);

    return NextResponse.json({
      companies: filteredCompanies,
      pagination: adjustedPagination,
    });
  } catch (error) {
    console.error('Error searching companies:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search companies' },
      { status: 500 }
    );
  }
}
