import { HttpStatus, Injectable } from '@nestjs/common';
import {
  companyProfileSectionsSchema,
  recruiterProfileSectionsSchema,
  type CompanyProfileInput,
  type EmployerProfileSettings,
  type RecruiterProfileInput,
} from '@viecpro/shared';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { EmployerContext } from './employer-context.service.js';
import { mergeSections, readSections } from './profile-sections.js';

/** Cài đặt hồ sơ công khai trong khu NTD: hồ sơ tư vấn viên (mọi cán bộ) và hồ sơ công ty (quản trị viên doanh nghiệp) */
@Injectable()
export class EmployerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: EmployerContext,
    private readonly assets: AssetUrlService,
  ) {}

  async get(userId: string): Promise<EmployerProfileSettings> {
    const actor = await this.ctx.resolve(userId);
    const r = await this.prisma.recruiter.findUniqueOrThrow({
      where: { id: actor.recruiterId },
      select: {
        slug: true,
        name: true,
        title: true,
        headline: true,
        intro: true,
        city: true,
        phone: true,
        photoUrl: true,
        sections: true,
        companyAdmin: true,
        employer: {
          select: { slug: true, name: true, taxCode: true, verified: true, shortName: true, intro: true, phone: true, email: true, website: true, address: true, logoUrl: true, coverUrl: true, sections: true },
        },
      },
    });
    const e = actor.employerId ? r.employer : null;
    return {
      kind: e ? 'company' : 'individual',
      recruiter: {
        slug: r.slug,
        name: r.name,
        title: r.title,
        headline: r.headline,
        intro: r.intro,
        city: r.city,
        phone: r.phone,
        photoUrl: this.assets.url(r.photoUrl),
        sections: readSections(recruiterProfileSectionsSchema, r.sections),
      },
      company: e && {
        slug: e.slug,
        name: e.name,
        taxCode: e.taxCode,
        verified: e.verified,
        shortName: e.shortName,
        intro: e.intro,
        phone: e.phone,
        email: e.email,
        website: e.website,
        address: e.address,
        logoUrl: this.assets.url(e.logoUrl),
        coverUrl: this.assets.url(e.coverUrl),
        sections: readSections(companyProfileSectionsSchema, e.sections),
        canEdit: r.companyAdmin,
      },
    };
  }

  async updateRecruiter(userId: string, input: RecruiterProfileInput): Promise<EmployerProfileSettings> {
    const actor = await this.ctx.resolve(userId);
    const current = await this.prisma.recruiter.findUniqueOrThrow({ where: { id: actor.recruiterId }, select: { photoUrl: true, sections: true } });
    const photoUrl = this.ownedImage(userId, input.photoPath, current.photoUrl, 'photoPath');
    await this.prisma.$transaction([
      this.prisma.recruiter.update({
        where: { id: actor.recruiterId },
        data: {
          name: input.name,
          title: input.title,
          headline: input.headline,
          intro: input.intro,
          city: input.city,
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(photoUrl !== undefined && { photoUrl }),
          sections: mergeSections(current.sections, input.sections),
        },
      }),
      // Tên hiển thị trong khu quản lý lấy từ tài khoản – giữ trùng với hồ sơ công khai
      this.prisma.user.update({ where: { id: userId }, data: { name: input.name } }),
    ]);
    return this.get(userId);
  }

  async updateCompany(userId: string, input: CompanyProfileInput): Promise<EmployerProfileSettings> {
    const actor = await this.ctx.resolve(userId);
    if (!actor.employerId) throw ApiException.notFound('Tài khoản không thuộc doanh nghiệp nào');
    const me = await this.prisma.recruiter.findUniqueOrThrow({ where: { id: actor.recruiterId }, select: { companyAdmin: true } });
    if (!me.companyAdmin) throw ApiException.forbidden('Chỉ quản trị viên doanh nghiệp được sửa hồ sơ công ty');

    const current = await this.prisma.employer.findUniqueOrThrow({ where: { id: actor.employerId }, select: { logoUrl: true, coverUrl: true, sections: true } });
    const logoUrl = this.ownedImage(userId, input.logoPath, current.logoUrl, 'logoPath');
    const coverUrl = this.ownedImage(userId, input.coverPath, current.coverUrl, 'coverPath');
    await this.prisma.employer.update({
      where: { id: actor.employerId },
      data: {
        shortName: input.shortName,
        intro: input.intro,
        address: input.address,
        website: input.website,
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(coverUrl !== undefined && { coverUrl }),
        sections: mergeSections(current.sections, input.sections),
      },
    });
    return this.get(userId);
  }

  /** undefined = giữ nguyên, null = gỡ ảnh; ảnh mới phải do chính người này tải lên */
  private ownedImage(userId: string, path: string | null | undefined, existing: string | null, field: string): string | null | undefined {
    if (path === undefined || path === existing) return undefined;
    if (path === null) return null;
    if (!path.startsWith(`uploads/${userId}/`)) {
      throw new ApiException('VALIDATION_ERROR', 'Chỉ được dùng ảnh đã tải lên', HttpStatus.BAD_REQUEST, { [field]: 'Tải ảnh lên trước khi chọn' });
    }
    return path;
  }
}
