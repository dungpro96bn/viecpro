import { Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { companyProfileSchema, recruiterProfileSchema, type CompanyProfileInput, type EmployerProfileSettings, type RecruiterProfileInput } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody } from '../../core/http/zod.js';
import { EmployerProfileService } from './employer-profile.service.js';

@ApiTags('Nhà tuyển dụng – quản lý')
@ApiBearerAuth()
@Roles('employer')
@Controller('employer/profile')
export class EmployerProfileController {
  constructor(private readonly profile: EmployerProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Cài đặt hồ sơ công khai: hồ sơ tư vấn viên và hồ sơ công ty' })
  get(@CurrentUser() user: AuthPayload): Promise<EmployerProfileSettings> {
    return this.profile.get(user.sub);
  }

  @Put('recruiter')
  @ApiOperation({ summary: 'Sửa hồ sơ tư vấn viên của chính mình (trang /tu-van-vien/[slug])' })
  updateRecruiter(@CurrentUser() user: AuthPayload, @ZodBody(recruiterProfileSchema) body: RecruiterProfileInput): Promise<EmployerProfileSettings> {
    return this.profile.updateRecruiter(user.sub, body);
  }

  @Put('company')
  @ApiOperation({ summary: 'Sửa hồ sơ công ty (chỉ quản trị viên doanh nghiệp; tên pháp lý / MST đổi qua xác minh)' })
  updateCompany(@CurrentUser() user: AuthPayload, @ZodBody(companyProfileSchema) body: CompanyProfileInput): Promise<EmployerProfileSettings> {
    return this.profile.updateCompany(user.sub, body);
  }
}
