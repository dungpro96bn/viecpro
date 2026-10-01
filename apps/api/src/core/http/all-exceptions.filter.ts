import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiError, ErrorCode } from '@viecpro/shared';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

const STATUS_CODE: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  501: 'NOT_IMPLEMENTED',
};

/** Mọi lỗi đều trả về cùng định dạng ApiError { statusCode, code, message, fields? } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toApiError(exception);
    if (body.statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút' };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      // ApiException đã có sẵn đúng định dạng
      if (typeof res === 'object' && res !== null && 'code' in res) return res as ApiError;
      const message = typeof res === 'string' ? res : ((res as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        code: STATUS_CODE[status] ?? 'INTERNAL_ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return { statusCode: 409, code: 'CONFLICT', message: 'Dữ liệu đã tồn tại' };
      if (exception.code === 'P2025') return { statusCode: 404, code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu' };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Có lỗi xảy ra, vui lòng thử lại sau' };
  }
}
