import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { employerReviewCreateSchema, employerReviewResponseSchema, paginationSchema, type EmployerReviewCreateInput, type EmployerReviewList, type EmployerReviewMine, type EmployerReviewReceipt, type EmployerReviewResponseInput, type PaginationQuery } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { EmployerReviewsService } from './employer-reviews.service.js';

@ApiTags('Nhà tuyển dụng – đánh giá')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/reviews')
export class EmployerReviewsController {
  constructor(private readonly reviews: EmployerReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đánh giá người lao động đã xuất cảnh' })
  list(@CurrentUser() user: AuthPayload, @ZodQuery(paginationSchema) query: PaginationQuery): Promise<EmployerReviewList> {
    return this.reviews.list(user.sub, query);
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Phản hồi đánh giá (chỉ trong phạm vi NTD)' })
  async respond(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(employerReviewResponseSchema) body: EmployerReviewResponseInput) {
    await this.reviews.respond(user.sub, id, body);
  }
}

@ApiTags('Ứng tuyển')
@ApiBearerAuth()
@Roles('seeker')
@Controller('me/applications')
export class SeekerReviewsController {
  constructor(private readonly reviews: EmployerReviewsService) {}

  @Get(':id/review')
  @ApiOperation({ summary: 'Kiểm tra quyền đánh giá hồ sơ đã xuất cảnh' })
  mine(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerReviewMine | null> {
    return this.reviews.mine(user.sub, id);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đánh giá tư vấn viên sau khi hồ sơ đã xuất cảnh' })
  submit(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(employerReviewCreateSchema) body: EmployerReviewCreateInput): Promise<EmployerReviewReceipt> {
    return this.reviews.submit(user.sub, id, body);
  }
}
