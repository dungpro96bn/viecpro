export const PLAN_CATALOG = {
  free: { key: 'free', name: 'Miễn phí', priceVnd: 0, durationDays: 30, jobQuota: 3, boostQuota: 0, audience: 'all' },
  ca_nhan_plus: { key: 'ca_nhan_plus', name: 'Cá nhân Plus', priceVnd: 299000, durationDays: 30, jobQuota: 10, boostQuota: 10, audience: 'individual' },
  pro: { key: 'pro', name: 'Pro', priceVnd: 2199000, durationDays: 90, jobQuota: 30, boostQuota: 40, audience: 'all' },
  doanh_nghiep: { key: 'doanh_nghiep', name: 'Doanh nghiệp', priceVnd: 18999000, durationDays: 365, jobQuota: 100, boostQuota: 150, audience: 'company' },
} as const;
export type PlanKey = keyof typeof PLAN_CATALOG;
export type PlanDefinition = (typeof PLAN_CATALOG)[PlanKey];
