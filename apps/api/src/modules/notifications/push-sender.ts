import { Inject, Injectable, Logger } from '@nestjs/common';
import { createSign } from 'node:crypto';
import { ENV, type Env } from '../../config/env.js';

export interface PushMessage {
  title: string;
  body?: string | null;
  /** Deep link mở màn hình trong app */
  link?: string | null;
}

/**
 * Kênh gửi thông báo đẩy tới app mobile. Khi có app: viết FcmPushSender (Firebase Admin SDK,
 * gửi được cả Android và iOS qua APNs) rồi đổi provider trong notifications.module.ts.
 */
export abstract class PushSender {
  abstract send(tokens: string[], message: PushMessage): Promise<void>;
}

@Injectable()
export class LogPushSender extends PushSender {
  private readonly logger = new Logger('Push');

  async send(tokens: string[], message: PushMessage) {
    if (tokens.length) this.logger.log(`${tokens.length} thiết bị ← ${message.title}`);
  }
}

/** Firebase Cloud Messaging HTTP v1 adapter. */
@Injectable()
export class FcmPushSender extends PushSender {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(@Inject(ENV) private readonly env: Env) { super(); }

  private async bearerToken() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const email = this.env.FCM_CLIENT_EMAIL;
    const privateKey = this.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!email || !privateKey) throw new Error('FCM provider is missing service credentials');
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`FCM OAuth request failed with status ${response.status}`);
    const body = await response.json() as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('FCM OAuth response missing access token');
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }

  async send(tokens: string[], message: PushMessage) {
    if (!tokens.length) return;
    const project = this.env.FCM_PROJECT_ID;
    if (!project) throw new Error('FCM project is not configured');
    const bearer = await this.bearerToken();
    const results = await Promise.all(tokens.map((token) => fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: { title: message.title, ...(message.body && { body: message.body }) }, ...(message.link && { data: { link: message.link } }) } }),
      signal: AbortSignal.timeout(8000),
    })));
    const failed = results.filter((response) => !response.ok).length;
    if (failed) throw new Error(`FCM rejected ${failed} of ${results.length} messages`);
  }
}
