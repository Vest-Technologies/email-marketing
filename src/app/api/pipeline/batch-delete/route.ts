import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/pipeline/batch-delete - Delete multiple companies at once
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyIds, alsoDeleteFromFetched = false } = body as {
      companyIds: string[];
      alsoDeleteFromFetched?: boolean;
    };

    if (!companyIds || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company IDs provided' },
        { status: 400 }
      );
    }

    const results = {
      deleted: 0,
      failed: 0,
      errors: [] as Array<{ companyId: string; companyName: string; error: string }>,
    };

    // Get companies to delete (for error reporting and apolloId lookup)
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, apolloId: true },
    });

    const companyMap = new Map(companies.map(c => [c.id, { name: c.name, apolloId: c.apolloId }]));

    for (const companyId of companyIds) {
      try {
        const companyInfo = companyMap.get(companyId);
        const companyName = companyInfo?.name || 'Unknown';
        const apolloId = companyInfo?.apolloId;

        // Delete in transaction: first email, then company, optionally FetchedOrganization
        await prisma.$transaction(async (tx) => {
          // Delete associated email if exists
          await tx.email.deleteMany({
            where: { companyId },
          });

          // Delete associated audit logs
          await tx.auditLog.deleteMany({
            where: { entityId: companyId },
          });

          // Delete the company
          await tx.company.delete({
            where: { id: companyId },
          });

          // Optionally delete from FetchedOrganization
          if (alsoDeleteFromFetched && apolloId) {
            await tx.fetchedOrganization.deleteMany({
              where: { apolloId },
            });
          }
        });

        results.deleted++;
      } catch (error) {
        console.error(`Error deleting company ${companyId}:`, error);
        results.failed++;
        results.errors.push({
          companyId,
          companyName: companyMap.get(companyId)?.name || 'Unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error in batch delete:', error);
    return NextResponse.json(
      { error: 'Failed to batch delete companies' },
      { status: 500 }
    );
  }
}
