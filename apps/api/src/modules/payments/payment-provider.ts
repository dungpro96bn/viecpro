import { createHmac, timingSafeEqual } from 'node:crypto';

export abstract class PaymentProvider {
  abstract readonly key: string;
  abstract createCheckout(order: { code: string; amountVnd: number; description: string; returnUrl: string }): Promise<{ checkoutUrl: string; providerRef: string }>;
  abstract parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): { providerRef: string; status: 'paid' | 'failed'; amountVnd: number };
}

export class MockPaymentProvider extends PaymentProvider {
  readonly key = 'mock';
  constructor(private readonly secret: string, private readonly webBaseUrl: string) { super(); }
  async createCheckout(order: { code: string; amountVnd: number; description: string; returnUrl: string }) {
    const providerRef = order.code;
    const url = new URL('/thanh-toan/mo-phong', this.webBaseUrl);
    url.searchParams.set('ref', providerRef);
    url.searchParams.set('return', order.returnUrl);
    return { checkoutUrl: url.toString(), providerRef };
  }
  sign(payload: object) { return createHmac('sha256', this.secret).update(JSON.stringify(payload)).digest('hex'); }
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer) {
    const signature = headers['x-payment-signature'];
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('Invalid payment signature');
    const expected = Buffer.from(createHmac('sha256', this.secret).update(rawBody).digest('hex'));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid payment signature');
    const data = JSON.parse(rawBody.toString()) as { providerRef?: string; status?: string; amountVnd?: number };
    if (!data.providerRef || !['paid', 'failed'].includes(data.status ?? '') || !Number.isInteger(data.amountVnd)) throw new Error('Invalid payment payload');
    return { providerRef: data.providerRef, status: data.status as 'paid' | 'failed', amountVnd: data.amountVnd! };
  }
}
