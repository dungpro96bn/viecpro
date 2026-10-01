import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@viecpro/shared';

/**
 * Lỗi nghiệp vụ có mã cố định – web / mobile dựa vào `code` để xử lý.
 * Ví dụ: throw new ApiException('PHONE_TAKEN', 'Số điện thoại đã được đăng ký', HttpStatus.CONFLICT)
 */
export class ApiException extends HttpException {
  constructor(code: ErrorCode, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST, fields?: Record<string, string>) {
    const body: ApiError = { statusCode: status, code, message, ...(fields && { fields }) };
    super(body, status);
  }

  static notFound(message = 'Không tìm thấy dữ liệu') {
    return new ApiException('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
    return new ApiException('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}
