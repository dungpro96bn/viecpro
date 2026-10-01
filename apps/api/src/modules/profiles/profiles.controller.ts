import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { EmployerProfile, RecruiterProfile } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Public } from '../../core/auth/auth.decorators.js';
import { ProfilesService } from './profiles.service.js';

/** Đơn hàng của NTD / tư vấn viên lấy qua GET /jobs?employer=<slug> hoặc ?recruiter=<slug> */
@ApiTags('Nhà tuyển dụng & tư vấn viên')
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Public()
  @Get('employers/:slug')
  @ApiOperation({ summary: 'Hồ sơ nhà tuyển dụng doanh nghiệp' })
  employer(@Param('slug') slug: string, @CurrentUser() user?: AuthPayload): Promise<EmployerProfile> {
    return this.profiles.employer(slug, user?.sub);
  }

  @Put('employers/:slug/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Theo dõi nhà tuyển dụng' })
  async followEmployer(@CurrentUser() user: AuthPayload, @Param('slug') slug: string) {
    await this.profiles.follow(user.sub, 'employer', slug);
  }

  @Delete('employers/:slug/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bỏ theo dõi nhà tuyển dụng' })
  async unfollowEmployer(@CurrentUser() user: AuthPayload, @Param('slug') slug: string) {
    await this.profiles.unfollow(user.sub, 'employer', slug);
  }

  @Public()
  @Get('recruiters/:slug')
  @ApiOperation({ summary: 'Hồ sơ tư vấn viên / nhà tuyển dụng cá nhân' })
  recruiter(@Param('slug') slug: string, @CurrentUser() user?: AuthPayload): Promise<RecruiterProfile> {
    return this.profiles.recruiter(slug, user?.sub);
  }

  @Get('recruiters/:slug/phone')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hiện số điện thoại đầy đủ (cần đăng nhập)' })
  phone(@Param('slug') slug: string) {
    return this.profiles.recruiterPhone(slug);
  }

  @Put('recruiters/:slug/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Theo dõi tư vấn viên' })
  async followRecruiter(@CurrentUser() user: AuthPayload, @Param('slug') slug: string) {
    await this.profiles.follow(user.sub, 'recruiter', slug);
  }

  @Delete('recruiters/:slug/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bỏ theo dõi tư vấn viên' })
  async unfollowRecruiter(@CurrentUser() user: AuthPayload, @Param('slug') slug: string) {
    await this.profiles.unfollow(user.sub, 'recruiter', slug);
  }
}
