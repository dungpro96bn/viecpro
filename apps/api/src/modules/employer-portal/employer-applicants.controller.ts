import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  applicantDuplicateSchema,
  applicantJobMatchSchema,
  applicantNoteSchema,
  importApplicantsSchema,
  manualApplicantSchema,
  type ApplicantDuplicateCheck,
  type ApplicantDuplicateQuery,
  type ApplicantImportResult,
  type ApplicantJobMatch,
  type ApplicantJobMatchQuery,
  type EmployerApplicantItem,
  type ImportApplicantsInput,
  type ManualApplicantInput,
  applicationListSchema,
  applicationStatusSchema,
  type ApplicantNoteInput,
  type ApplicantNoteItem,
  type ApplicationListQuery,
  type ApplicationStatusInput,
  type EmployerApplicantDetail,
  type EmployerApplicantList,
} from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { EmployerApplicantsService } from './employer-applicants.service.js';
import { EmployerIntakeService } from './employer-intake.service.js';

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/applications')
export class EmployerApplicantsController {
  constructor(
    private readonly applicants: EmployerApplicantsService,
    private readonly intake: EmployerIntakeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Hồ sơ ứng tuyển các đơn của NTD: lọc theo bước, đơn, mức phù hợp, lọc nhanh' })
  list(@CurrentUser() user: AuthPayload, @ZodQuery(applicationListSchema) query: ApplicationListQuery): Promise<EmployerApplicantList> {
    return this.applicants.list(user.sub, query);
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Kiểm tra trùng hồ sơ theo số điện thoại / họ tên' })
  duplicates(@CurrentUser() user: AuthPayload, @ZodQuery(applicantDuplicateSchema) query: ApplicantDuplicateQuery): Promise<ApplicantDuplicateCheck> {
    return this.intake.duplicates(user.sub, query);
  }

  @Get('job-match')
  @ApiOperation({ summary: 'Tin đang tuyển xếp theo % phù hợp với thông tin ứng viên đang nhập' })
  jobMatch(@CurrentUser() user: AuthPayload, @ZodQuery(applicantJobMatchSchema) query: ApplicantJobMatchQuery): Promise<ApplicantJobMatch[]> {
    return this.intake.jobMatch(user.sub, query);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'NTD thêm ứng viên thủ công (từ cuộc gọi, hồ sơ giấy…)' })
  create(@CurrentUser() user: AuthPayload, @ZodBody(manualApplicantSchema) body: ManualApplicantInput): Promise<EmployerApplicantItem> {
    return this.intake.create(user.sub, body);
  }

  @Post('import')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhập ứng viên hàng loạt từ tệp Excel / CSV (tối đa 500 dòng)' })
  import(@CurrentUser() user: AuthPayload, @ZodBody(importApplicantsSchema) body: ImportApplicantsInput): Promise<ApplicantImportResult> {
    return this.intake.import(user.sub, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hồ sơ: lý do phù hợp, giấy tờ, hoạt động, ghi chú nội bộ' })
  detail(@CurrentUser() user: AuthPayload, @Param('id') id: string): Promise<EmployerApplicantDetail> {
    return this.applicants.detail(user.sub, id);
  }

  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu NTD đã mở xem hồ sơ' })
  async seen(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    await this.applicants.markSeen(user.sub, id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Thêm ghi chú nội bộ (ứng viên không thấy)' })
  addNote(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(applicantNoteSchema) body: ApplicantNoteInput): Promise<ApplicantNoteItem> {
    return this.applicants.addNote(user.sub, id, body.body);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đổi bước tuyển dụng (đã liên hệ, phỏng vấn, trúng tuyển, loại) – báo cho ứng viên' })
  async status(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(applicationStatusSchema) body: ApplicationStatusInput) {
    await this.applicants.updateStatus(user.sub, id, body);
  }
}
