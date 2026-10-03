import { PLAN_CATALOG } from '@viecpro/shared';

export function canPublish(plan: { jobQuota: number; expiresAt: Date } | null, visibleJobs: number, now = new Date()) {
  if (plan && plan.expiresAt > now) return { allowed: visibleJobs < plan.jobQuota, reason: visibleJobs >= plan.jobQuota ? 'limit' as const : null };
  return { allowed: visibleJobs < PLAN_CATALOG.free.jobQuota, reason: plan ? 'expired' as const : visibleJobs >= PLAN_CATALOG.free.jobQuota ? 'limit' as const : null };
}

export function renewalExpiry(current: Date | null, durationDays: number, now = new Date()) {
  const from = current && current > now ? current : now;
  return new Date(from.getTime() + durationDays * 86400_000);
}
