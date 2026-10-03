import { describe, expect, it } from 'vitest';
import { canPublish, renewalExpiry } from './plan-rules.js';

describe('plan rules', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  it('enforces active package quota and free fallback', () => {
    const active = { jobQuota: 10, expiresAt: new Date('2026-11-01T00:00:00Z') };
    expect(canPublish(active, 9, now).allowed).toBe(true);
    expect(canPublish(active, 10, now)).toMatchObject({ allowed: false, reason: 'limit' });
    expect(canPublish(null, 2, now).allowed).toBe(true);
    expect(canPublish(null, 3, now)).toMatchObject({ allowed: false, reason: 'limit' });
  });
  it('uses free quota when package expired', () => {
    expect(canPublish({ jobQuota: 30, expiresAt: new Date('2026-10-02T00:00:00Z') }, 3, now)).toMatchObject({ allowed: false, reason: 'expired' });
  });
  it('extends from the later of current expiry and now', () => {
    expect(renewalExpiry(new Date('2026-10-20T00:00:00Z'), 30, now).toISOString()).toBe('2026-11-19T00:00:00.000Z');
    expect(renewalExpiry(new Date('2026-09-20T00:00:00Z'), 30, now).toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });
});
