import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ENV, type Env } from '../../config/env.js';
import { ApiException } from '../../core/http/api-exception.js';

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();
  constructor(@Inject(ENV) private readonly env: Env) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.env.GOOGLE_CLIENT_ID) throw new ApiException('NOT_IMPLEMENTED', 'Đăng nhập Google chưa được cấu hình', HttpStatus.NOT_IMPLEMENTED);
    let claims;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.env.GOOGLE_CLIENT_ID });
      claims = ticket.getPayload();
    } catch {
      throw new ApiException('INVALID_CREDENTIALS', 'Không thể xác thực tài khoản Google', HttpStatus.UNAUTHORIZED);
    }
    if (
      !claims?.sub || !claims.email || claims.email_verified !== true || !claims.name
    ) {
      throw new ApiException('INVALID_CREDENTIALS', 'Tài khoản Google chưa được xác thực', HttpStatus.UNAUTHORIZED);
    }
    return {
      subject: claims.sub,
      email: claims.email.toLowerCase(),
      name: claims.name,
      ...(claims.picture && { picture: claims.picture }),
    };
  }
}
