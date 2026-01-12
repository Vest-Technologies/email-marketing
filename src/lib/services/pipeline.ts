import prisma from '@/lib/prisma';
import { PIPELINE_STATES, type PipelineState } from '@/lib/constants';

// Valid state transitions
const VALID_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  [PIPELINE_STATES.PENDING_GENERATION]: [
    PIPELINE_STATES.EMAIL_NOT_GENERATED,
    PIPELINE_STATES.PENDING_REVIEW,
  ],
  [PIPELINE_STATES.EMAIL_NOT_GENERATED]: [
    PIPELINE_STATES.PENDING_GENERATION, // Allow retry
  ],
  [PIPELINE_STATES.PENDING_REVIEW]: [
    PIPELINE_STATES.APPROVED_TO_SEND,
    PIPELINE_STATES.PENDING_GENERATION, // Allow regeneration
  ],
  [PIPELINE_STATES.APPROVED_TO_SEND]: [
    PIPELINE_STATES.SENT,
    PIPELINE_STATES.PENDING_REVIEW, // Allow un-approve
  ],
  [PIPELINE_STATES.SENT]: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: PipelineState, to: PipelineState): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from];
  return allowedTransitions?.includes(to) ?? false;
}

/**
 * Transition a company to a new pipeline state
 */
export async function transitionState(
  companyId: string,
  toState: PipelineState,
  performedBy?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    return { success: false, error: 'Company not found' };
  }

  const fromState = company.pipelineState as PipelineState;

  if (!isValidTransition(fromState, toState)) {
    return {
      success: false,
      error: `Invalid state transition from ${fromState} to ${toState}`,
    };
  }

  // Perform transition and create audit log
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { pipelineState: toState },
    }),
    prisma.auditLog.create({
      data: {
        entityType: 'company',
        entityId: companyId,
        action: 'state_change',
        fromState,
        toState,
        metadata: metadata as object,
        performedBy,
      },
    }),
  ]);

  return { success: true };
}

/**
 * Mark a company as email not generated
 */
export async function markEmailNotGenerated(
  companyId: string,
  reason: string,
  performedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await transitionState(
    companyId,
    PIPELINE_STATES.EMAIL_NOT_GENERATED,
    performedBy,
    { reason }
  );

  if (result.success) {
    await prisma.company.update({
      where: { id: companyId },
      data: { notGeneratedReason: { reason } },
    });
  }

  return result;
}

/**
 * Get pipeline statistics
 */
export async function getPipelineStats(): Promise<{
  total: number;
  byState: Record<PipelineState, number>;
}> {
  const counts = await prisma.company.groupBy({
    by: ['pipelineState'],
    _count: { id: true },
  });

  const byState = Object.fromEntries(
    Object.values(PIPELINE_STATES).map((state) => [state, 0])
  ) as Record<PipelineState, number>;

  let total = 0;
  for (const count of counts) {
    byState[count.pipelineState as PipelineState] = count._count.id;
    total += count._count.id;
  }

  return { total, byState };
}

/**
 * Get companies by state
 */
export async function getCompaniesByState(
  state: PipelineState,
  limit?: number,
  offset?: number
): Promise<{
  companies: Awaited<ReturnType<typeof prisma.company.findMany>>;
  total: number;
}> {
  const where = {
    pipelineState: state,
  };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        email: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.company.count({ where }),
  ]);

  return { companies, total };
}

/**
 * Get recent audit logs
 */
export async function getAuditLogs(
  entityId?: string,
  limit: number = 50
): Promise<Awaited<ReturnType<typeof prisma.auditLog.findMany>>> {
  return prisma.auditLog.findMany({
    where: entityId ? { entityId } : undefined,
    orderBy: { performedAt: 'desc' },
    take: limit,
  });
}
