import { APOLLO_API_BASE_URL, TARGET_TITLES } from '@/lib/constants';
import prisma from '@/lib/prisma';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

export interface ApolloFilters {
  locations?: string[];
  employeeCountMin?: number;
  employeeCountMax?: number;
  industries?: string[];
  keywords?: string[];
}

export interface ApolloCompany {
  id: string;
  organization_id?: string; // The organization ID needed for people search (different from account id)
  name: string;
  domain?: string;
  primary_domain?: string;
  website_url?: string;
  industry?: string;
  city?: string;
  state?: string;
  country?: string;
  employee_count?: number;
}

export interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  email?: string;
  title?: string;
  organization_id?: string;
  has_email?: boolean;
  organization?: {
    name?: string;
    id?: string;
  };
}

interface ApolloSearchResponse {
  accounts?: ApolloCompany[];
  people?: ApolloPerson[];
  organizations?: ApolloCompany[];
  pagination?: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

interface ApolloMatchResponse {
  person?: ApolloPerson;
}

async function apolloRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  queryParams?: Record<string, string | string[]>
): Promise<T> {
  if (!APOLLO_API_KEY) {
    throw new Error('APOLLO_API_KEY is not configured');
  }

  // Build URL with query parameters
  // Apollo API expects:
  // - Arrays: organization_ids[]=id1&organization_ids[]=id2
  // - Comma-separated strings: person_titles[]=ceo, manager
  let url = `${APOLLO_API_BASE_URL}${endpoint}`;
  if (queryParams) {
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (Array.isArray(value)) {
        // Key already includes [] (e.g., 'organization_ids[]')
        // Append each value with the same key
        value.forEach(v => urlParams.append(key, String(v)));
      } else {
        // String values (including comma-separated) - keep key as is (with [] if present)
        urlParams.append(key, String(value));
      }
    }
    const queryString = urlParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Log request details
  console.log(`[Apollo] Request to ${endpoint}:`, {
    url,
    queryParams: queryParams || {},
    body: {
      ...body,
      // Truncate large arrays for logging
      person_titles: body.person_titles && Array.isArray(body.person_titles)
        ? `${body.person_titles.length} titles (${body.person_titles.slice(0, 3).join(', ')}...)`
        : body.person_titles,
    },
  });

  // According to Apollo API docs: https://docs.apollo.io/reference/people-api-search
  // Headers should include: Content-Type, X-Api-Key, Cache-Control
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': APOLLO_API_KEY,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Apollo] API error ${response.status}:`, errorText);
    throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Log full response body
  console.log(`[Apollo] Response from ${endpoint}:`, JSON.stringify(data, null, 2));

  return data;
}

/**
 * 1. Şirket filtreleme
 * According to Apollo API docs: https://docs.apollo.io/reference/organization-search
 */
export async function searchCompanies(
  filters: ApolloFilters,
  page: number = 1,
  perPage: number = 50
): Promise<{ companies: ApolloCompany[]; pagination: ApolloSearchResponse['pagination'] }> {
  // According to Apollo API docs and example:
  // All parameters go in query params (including page and per_page)
  const body: Record<string, unknown> = {};

  const queryParams: Record<string, string | string[]> = {
    'page': String(page),
    'per_page': String(perPage),
  };

  // Filters in query params (as shown in example)
  if (filters.locations?.length) {
    queryParams['organization_locations[]'] = filters.locations;
  }

  if (filters.employeeCountMin !== undefined || filters.employeeCountMax !== undefined) {
    const min = filters.employeeCountMin || 0;
    const max = filters.employeeCountMax || 10000;
    // Format: "50,1000" (comma-separated in single string, will be URL encoded)
    queryParams['organization_num_employees_ranges[]'] = `${min},${max}`;
  }

  if (filters.keywords?.length) {
    queryParams['q_organization_keyword_tags[]'] = filters.keywords;
  }

  if (filters.industries?.length) {
    // Add industries as keywords if keywords not already set
    if (!filters.keywords?.length) {
      queryParams['q_organization_keyword_tags[]'] = filters.industries;
    } else {
      // Merge industries with keywords
      queryParams['q_organization_keyword_tags[]'] = [...(filters.keywords || []), ...filters.industries];
    }
  }

  const response = await apolloRequest<ApolloSearchResponse>('/mixed_companies/search', body, Object.keys(queryParams).length > 0 ? queryParams : undefined);

  // Combine accounts and organizations
  const accounts = response.accounts || [];
  const organizations = response.organizations || [];
  const allCompanies = [...accounts, ...organizations] as any[];

  // Map to ApolloCompany format - use primary_domain if available, fallback to domain
  // IMPORTANT: organization_id is needed for people search, id is the account ID
  const mappedCompanies: ApolloCompany[] = allCompanies.map((c: any) => ({
    id: c.id,
    organization_id: c.organization_id || c.id, // organization_id for people search, fallback to id
    name: c.name,
    domain: c.primary_domain || c.domain || undefined,
    primary_domain: c.primary_domain || undefined,
    website_url: c.website_url || undefined,
    industry: c.industry || undefined,
    city: c.city || undefined,
    state: c.state || undefined,
    country: c.country || undefined,
    employee_count: c.employee_count || c.organization_headcount || undefined,
  }));

  // Remove duplicates by ID
  const uniqueCompanies = Array.from(
    new Map(mappedCompanies.map(c => [c.id, c])).values()
  );

  return {
    companies: uniqueCompanies,
    pagination: response.pagination,
  };
}

/**
 * Get target titles from database
 * No fallback - only use titles from database
 */
async function getTargetTitles(): Promise<string[]> {
  const titles = await prisma.targetTitle.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });

  if (!titles || titles.length === 0) {
    throw new Error('No active target titles found in database. Please add titles in the UI.');
  }

  return titles.map(t => t.title);
}

/**
 * 2. Şirketteki insanları title'lara göre filtreleme
 * According to Apollo API docs: https://docs.apollo.io/reference/people-api-search
 * Uses only documented parameters: organization_ids[]
 */
export async function findPeopleByTitle(
  organizationId: string,
  titles?: string[]
): Promise<ApolloPerson[]> {
  if (!organizationId) {
    throw new Error('organizationId is required for finding people by title');
  }

  const targetTitles = titles || await getTargetTitles();

  // According to Apollo API docs: https://docs.apollo.io/reference/people-api-search
  // All parameters go in query params (including page and per_page)
  const body: Record<string, unknown> = {};

  const queryParams: Record<string, string | string[]> = {
    'organization_ids[]': [organizationId],
    'page': '1',
    'per_page': '100',
    'include_similar_titles': 'true',
  };

  // Add person_titles as separate array items (reversed to prioritize English titles first)
  if (targetTitles.length > 0) {
    queryParams['person_titles[]'] = [...targetTitles].reverse();
  }

  console.log('[Apollo] Query params:', queryParams);

  const response = await apolloRequest<ApolloSearchResponse>('/mixed_people/api_search', body, queryParams);
  const people = response.people || [];

  console.log(people);

  // Clean data - note: this endpoint doesn't return email addresses, only has_email flag
  // Use enrichPerson endpoint to get actual email
  return people.map((p: any) => ({
    id: p.id,
    first_name: p.first_name || undefined,
    last_name: p.last_name || undefined,
    last_name_obfuscated: p.last_name_obfuscated || undefined,
    email: p.email || undefined,
    title: p.title || undefined,
    organization_id: p.organization?.id || p.organization_id || undefined,
    has_email: p.has_email || false,
    organization: p.organization || undefined,
  }));
}

/**
 * 3. Email görüntüleme/enrich etme
 * According to Apollo API docs: https://docs.apollo.io/reference/people-enrichment
 * Uses person_id to reveal email address
 */
export async function enrichPerson(
  personId: string
): Promise<ApolloPerson | null> {
  if (!personId) {
    throw new Error('personId is required for enriching person');
  }

  // According to Apollo API docs, use person_id to reveal email
  // Endpoint: GET /v1/people/{person_id} or POST /v1/people/match with person_id
  const body: Record<string, unknown> = {
    person_id: personId,
    reveal_personal_emails: false,
    reveal_phone_number: false,
  };

  const response = await apolloRequest<ApolloMatchResponse>('/people/match', body);
  return response.person || null;
}

/**
 * Find best contact with target titles and email
 * Uses only documented Apollo API methods
 * Returns first person from search results (API should return sorted by seniority if possible)
 */
export async function findBestContact(
  organizationName: string,
  organizationId: string
): Promise<{
  person: ApolloPerson | null;
  enrichedEmail: string | null;
  title: string | null;
}> {
  const people = await findPeopleByTitle(organizationId);

  if (people.length === 0) {
    return { person: null, enrichedEmail: null, title: null };
  }

  // Try to find someone with email (check first few people)
  for (const candidate of people.slice(0, 10)) {
    if (!candidate.first_name) continue;

    // Use existing email if available
    if (candidate.email) {
      return {
        person: candidate,
        enrichedEmail: candidate.email,
        title: candidate.title || null,
      };
    }

    // Only try to enrich if has_email flag is true (saves API calls)
    if (candidate.has_email && candidate.id) {
      // Try to enrich email using person_id
      const enriched = await enrichPerson(candidate.id);

      if (enriched?.email) {
        return {
          person: { ...candidate, email: enriched.email },
          enrichedEmail: enriched.email,
          title: candidate.title || null,
        };
      }
    }
  }

  // No one found with email
  return { person: null, enrichedEmail: null, title: null };
}
