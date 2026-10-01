import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  interviewAvailabilitySchema,
  interviewCandidatesSchema,
  interviewCreateSchema,
  interviewRangeSchema,
  type InterviewAvailability,
  type InterviewAvailabilityQuery,
  type InterviewCandidate,
  type InterviewCandidatesQuery,
  type InterviewCreateInput,
  interviewRescheduleSchema,
  interviewResultSchema,
  type EmployerInterviewItem,
  type EmployerInterviewWeek,
  type InterviewRangeQuery,
  type InterviewRescheduleInput,
  type InterviewResultInput,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { EmployerInterviewCreateService } from './employer-interview-create.service.js';
import { EmployerInterviewsService } from './employer-interviews.service.js';

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/interviews')
export class EmployerInterviewsController {
  constructor(
    private readonly interviews: EmployerInterviewsService,
    private readonly creator: EmployerInterviewCreateService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lịch hẹn trong khoảng ngày (tuần / danh sách) + thống kê, loại lịch, người phỏng vấn' })
  week(@CurrentUser() user: AuthPayload, @ZodQuery(interviewRangeSchema) query: InterviewRangeQuery): Promise<EmployerInterviewWeek> {
    return this.interviews.week(user.sub, query);
  }

  @Get('candidates')
  @ApiOperation({ summary: 'Ứng viên đang chờ hẹn (xếp theo % phù hợp) + hồ sơ chọn sẵn' })
  candidates(@CurrentUser() user: AuthPayload, @ZodQuery(interviewCandidatesSchema) query: InterviewCandidatesQuery): Promise<InterviewCandidate[]> {
    return this.creator.candidates(user.sub, query);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Khung giờ bận của người phỏng vấn theo ngày' })
  availability(@CurrentUser() user: AuthPayload, @ZodQuery(interviewAvailabilitySchema) query: InterviewAvailabilityQuery): Promise<InterviewAvailability> {
    return this.creator.availability(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo lịch hẹn và gửi lời mời cho ứng viên' })
  create(@CurrentUser() user: AuthPayload, @ZodBody(interviewCreateSchema) body: InterviewCreateInput): Promise<EmployerInterviewItem> {
    return this.creator.create(user.sub, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết lịch hẹn' })
  detail(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerInterviewItem> {
    return this.interviews.detail(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Dời lịch (ứng viên xác nhận lại, gửi thông báo)' })
  reschedule(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(interviewRescheduleSchema) body: InterviewRescheduleInput): Promise<EmployerInterviewItem> {
    return this.interviews.reschedule(user.sub, id, body);
  }

  @Post(':id/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi kết quả: tham gia / vắng mặt + nhận xét' })
  result(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(interviewResultSchema) body: InterviewResultInput): Promise<EmployerInterviewItem> {
    return this.interviews.recordResult(user.sub, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Huỷ lịch hẹn (báo cho ứng viên)' })
  async cancel(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.interviews.cancel(user.sub, id);
  }
}
