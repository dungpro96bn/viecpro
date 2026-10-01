import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from './api-exception.js';

/** Header bắt buộc khi xác thực bằng cookie (refresh / logout). Web và admin luôn gửi kèm. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'viecpro';

export function assertCsrfHeader(req: Request) {
  if (req.headers[CSRF_HEADER] !== CSRF_VALUE) {
    throw new ApiException('FORBIDDEN', 'Yêu cầu không hợp lệ', HttpStatus.FORBIDDEN);
  }
}
