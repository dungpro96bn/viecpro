import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';

/**
 * Đổi đường dẫn ảnh tương đối ("/images/jobs/job-01.jpg") thành URL tuyệt đối.
 * App mobile không có "trang gốc" như web nên API luôn trả URL đầy đủ.
 */
@Injectable()
export class AssetUrlService {
  private readonly base: string;

  constructor(@Inject(ENV) env: Env) {
    this.base = env.ASSET_BASE_URL.replace(/\/$/, '');
  }

  url(path: string): string;
  url(path: string | null | undefined): string | null;
  url(path: string | null | undefined): string | null {
    if (!path) return null;
    return /^https?:\/\//.test(path) ? path : `${this.base}${path.startsWith('/') ? '' : '/'}${path}`;
  }
}
