import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';

/** Tệp người dùng tải lên lưu cục bộ (STORAGE_PROVIDER=local) được API phục vụ dưới đường dẫn này */
export const LOCAL_FILES_ROUTE = '/files';

/**
 * Đổi đường dẫn ảnh tương đối ("/images/jobs/job-01.jpg") thành URL tuyệt đối.
 * App mobile không có "trang gốc" như web nên API luôn trả URL đầy đủ.
 */
@Injectable()
export class AssetUrlService {
  private readonly base: string;
  /** Gốc URL của tệp tải lên khi lưu cục bộ; null khi dùng S3 (tệp nằm sau ASSET_BASE_URL / CDN) */
  private readonly localBase: string | null;

  constructor(@Inject(ENV) env: Env) {
    this.base = env.ASSET_BASE_URL.replace(/\/$/, '');
    this.localBase = env.STORAGE_PROVIDER === 'local' ? `${env.API_PUBLIC_URL.replace(/\/$/, '')}${LOCAL_FILES_ROUTE}` : null;
  }

  url(path: string): string;
  url(path: string | null | undefined): string | null;
  url(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    const relative = path.startsWith('/') ? path : `/${path}`;
    return `${this.localBase && relative.startsWith('/uploads/') ? this.localBase : this.base}${relative}`;
  }
}
