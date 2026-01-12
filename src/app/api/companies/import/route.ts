import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { type ApolloCompany } from '@/lib/services/apollo';

// POST /api/companies/import - Import selected companies
// NOTE: Does NOT fetch employees - saves Apollo credits
// Employees are fetched when preparing to send email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companies } = body as {
      companies: ApolloCompany[];
    };

    if (!companies || companies.length === 0) {
      return NextResponse.json(
        { error: 'No companies provided' },
        { status: 400 }
      );
    }

    const importedCompanies = [];

    for (const company of companies) {
      // Check if company already exists (by apolloId or domain)
      const existing = await prisma.company.findFirst({
        where: {
          OR: [
            { apolloId: company.id },
            { domain: company.domain || '' },
          ],
        },
      });

      if (existing) {
        // Update existing company to pending_generation if not already in that state
        if (existing.pipelineState !== 'pending_generation') {
          await prisma.company.update({
            where: { id: existing.id },
            data: { pipelineState: 'pending_generation' },
          });
          existing.pipelineState = 'pending_generation';
        }
        importedCompanies.push(existing);
        continue;
      }

      // Create new company - NO employee data yet
      const newCompany = await prisma.company.create({
        data: {
          apolloId: company.id,
          name: company.name,
          domain: company.domain || '',
          website: company.website_url,
          industry: company.industry,
          location: [company.city, company.state, company.country]
            .filter(Boolean)
            .join(', '),
          employeeCount: company.employee_count,
          // Pipeline starts at pending_generation
          pipelineState: 'pending_generation',
        },
      });

      importedCompanies.push(newCompany);
    }

    return NextResponse.json({
      success: true,
      imported: importedCompanies.length,
      companies: importedCompanies,
    });
  } catch (error) {
    console.error('Error importing companies:', error);
    return NextResponse.json(
      { error: 'Failed to import companies' },
      { status: 500 }
    );
  }
}
