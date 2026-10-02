import { Controller, HttpCode, HttpStatus, Param, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../core/auth/auth.decorators.js';
import { UploadService } from '../../core/assets/upload.service.js';

/** Thay cho presigned URL của S3 khi STORAGE_PROVIDER=local: link do /me/assets/presign cấp, có chữ ký và hạn 5 phút */
@ApiTags('Tệp tải lên')
@Public()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadService) {}

  @Put(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Nhận nội dung tệp qua link tải lên đã ký (chỉ khi lưu tệp cục bộ)' })
  async receive(@Param('token') token: string, @Req() req: Request): Promise<void> {
    await this.uploads.receiveLocal(token, req.headers['content-type'], req);
  }
}
