import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from './payment-provider.js';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider('x'.repeat(40), 'http://localhost:3100');
  it('verifies HMAC over raw body and normalizes event', () => {
    const body = { providerRef: 'VPP-1', status: 'paid', amountVnd: 299000 };
    const raw = Buffer.from(JSON.stringify(body));
    expect(provider.parseWebhook({ 'x-payment-signature': provider.sign(body) }, raw)).toEqual(body);
    expect(() => provider.parseWebhook({ 'x-payment-signature': '0'.repeat(64) }, raw)).toThrow();
  });
});
