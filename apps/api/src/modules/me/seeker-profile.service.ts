import { HttpStatus, Injectable } from '@nestjs/common';
import {
  SEEKER_DOCUMENT_KEYS,
  SEEKER_SELF_UPLOAD_DOCUMENTS,
  type Gender,
  type Industry,
  type JlptLevel,
  type MaritalStatus,
  type SeekerDocument,
  type SeekerDocumentKey,
  type SeekerDocumentUploadInput,
  type SeekerProfile,
  type SeekerProfileInput,
  type SeekerProfileInsights,
} from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { ApiException } from '../../core/http/api-exception.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { profileCompletion } from './profile-completion.js';
import { mergeSkills, readDocuments, readExperiences, readSkills, readStoredDocuments, sortExperiences } from './seeker-profile-json.js';

const DAY = 86400_000;

/** Hồ sơ ứng viên (design 18): xem / sửa từng khối, giấy tờ xuất cảnh, số liệu NTD đã xem */
@Injectable()
export class SeekerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetUrlService,
    private readonly jobs: JobsService,
  ) {}

  async profile(userId: string): Promise<SeekerProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { seekerProfile: true } });
    const p = user.seekerProfile;
    const { completion, suggestions } = profileCompletion({
      name: !!user.name,
      phoneVerified: !!user.phoneVerifiedAt,
      email: !!user.email,
      avatar: !!user.avatarUrl,
      birthYear: !!p?.birthYear,
      gender: !!p?.gender,
      hometown: !!p?.hometown,
      programs: !!p?.programs.length,
      industries: !!p?.industries.length,
      prefs: !!p?.prefs.length,
      about: !!p?.about,
      jlpt: !!p?.jlpt,
      video: !!p?.videoUrl,
    });
    return {
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatarUrl: this.assets.url(user.avatarUrl),
      birthYear: p?.birthYear ?? null,
      gender: (p?.gender ?? null) as Gender | null,
      hometown: p?.hometown ?? null,
      address: p?.address ?? null,
      programs: p?.programs ?? [],
      industries: (p?.industries ?? []) as Industry[],
      prefs: p?.prefs ?? [],
      jlpt: p?.jlpt ?? null,
      about: p?.about ?? null,
      videoUrl: this.assets.url(p?.videoUrl),
      lookingForJob: p?.lookingForJob ?? true,
      discoverable: p?.discoverable ?? true,
      emailVerified: !!user.emailVerifiedAt && !!user.email,
      heightCm: p?.heightCm ?? null,
      weightKg: p?.weightKg ?? null,
      eyesight: p?.eyesight ?? null,
      maritalStatus: (p?.maritalStatus ?? null) as MaritalStatus | null,
      tattoo: p?.tattoo ?? null,
      desiredSalary: p?.desiredSalary ?? null,
      departWithin: (p?.departWithin ?? null) as SeekerProfile['departWithin'],
      maxFeeUsd: p?.maxFeeUsd ?? null,
      jlptLearning: (p?.jlptLearning ?? null) as JlptLevel | null,
      skills: readSkills(p?.skills),
      experiences: sortExperiences(readExperiences(p?.experiences)),
      documents: readDocuments(p?.documents),
      completion,
      suggestions,
    };
  }

  async update(userId: string, input: SeekerProfileInput): Promise<SeekerProfile> {
    const { name, email, avatarUrl, skills, experiences, ...rest } = input;
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true, email: true, seekerProfile: { select: { videoUrl: true, skills: true } } } });
    if (avatarUrl !== undefined || input.videoUrl !== undefined) {
      const owns = (path: string | null | undefined, existing: string | null | undefined) => !path || path === existing || path.startsWith(`uploads/${userId}/`);
      if (avatarUrl !== undefined && !owns(avatarUrl, current?.avatarUrl)) throw new ApiException('VALIDATION_ERROR', 'Chỉ được dùng ảnh đã tải lên hồ sơ', HttpStatus.BAD_REQUEST, { avatarUrl: 'Tải ảnh lên trước khi chọn' });
      if (input.videoUrl !== undefined && !owns(input.videoUrl, current?.seekerProfile?.videoUrl)) throw new ApiException('VALIDATION_ERROR', 'Chỉ được dùng video đã tải lên hồ sơ', HttpStatus.BAD_REQUEST, { videoUrl: 'Tải video lên trước khi chọn' });
    }
    if (email) {
      const taken = await this.prisma.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } });
      if (taken) throw new ApiException('CONFLICT', 'Email đã được dùng cho tài khoản khác', HttpStatus.CONFLICT, { email: 'Email đã được sử dụng' });
    }
    const profile: Prisma.SeekerProfileUpdateInput = {
      ...rest,
      ...(skills && { skills: mergeSkills(readSkills(current?.seekerProfile?.skills), skills) as unknown as Prisma.InputJsonValue }),
      ...(experiences && { experiences: sortExperiences(experiences) as unknown as Prisma.InputJsonValue }),
    };
    await this.prisma.user.update({
      where: { id: userId },
      // Đổi email thì phải xác thực lại bằng OTP ở lần ứng tuyển kế tiếp
      data: { name, email, avatarUrl, ...(email !== undefined && email !== current?.email && { emailVerifiedAt: null }), seekerProfile: { upsert: { create: profile as Prisma.SeekerProfileCreateWithoutUserInput, update: profile } } },
    });
    return this.profile(userId);
  }

  /** Ứng viên tải ảnh 4×6 → "đã tải lên", chờ cán bộ xác minh. Giấy tờ đã xác minh không tự thay được */
  async uploadDocument(userId: string, key: string, input: SeekerDocumentUploadInput): Promise<SeekerDocument[]> {
    if (!(SEEKER_DOCUMENT_KEYS as readonly string[]).includes(key)) throw ApiException.notFound('Không có mục giấy tờ này');
    if (!(SEEKER_SELF_UPLOAD_DOCUMENTS as readonly string[]).includes(key)) {
      throw new ApiException('NOT_IMPLEMENTED', 'Giấy tờ này gửi bản gốc cho cán bộ tư vấn để xác minh', HttpStatus.NOT_IMPLEMENTED);
    }
    if (!input.path.startsWith(`uploads/${userId}/`)) throw new ApiException('VALIDATION_ERROR', 'Chỉ được dùng tệp đã tải lên', HttpStatus.BAD_REQUEST, { path: 'Tải tệp lên trước khi gắn' });
    const p = await this.prisma.seekerProfile.findUnique({ where: { userId }, select: { documents: true } });
    const stored = readStoredDocuments(p?.documents);
    if (stored.find((d) => d.key === key)?.status === 'verified') {
      throw new ApiException('CONFLICT', 'Giấy tờ đã được xác minh, liên hệ cán bộ tư vấn nếu cần thay', HttpStatus.CONFLICT);
    }
    const next = [...stored.filter((d) => d.key !== key), { key: key as SeekerDocumentKey, status: 'uploaded' as const, note: null, path: input.path, uploadedAt: new Date().toISOString() }];
    const documents = next as unknown as Prisma.InputJsonValue;
    await this.prisma.seekerProfile.upsert({ where: { userId }, create: { userId, documents }, update: { documents } });
    return readDocuments(next);
  }

  async insights(userId: string): Promise<SeekerProfileInsights> {
    const now = Date.now();
    const [views7, viewsPrev, matchingJobs, recent] = await Promise.all([
      this.prisma.profileView.count({ where: { seekerId: userId, createdAt: { gte: new Date(now - 7 * DAY) } } }),
      this.prisma.profileView.count({ where: { seekerId: userId, createdAt: { gte: new Date(now - 14 * DAY), lt: new Date(now - 7 * DAY) } } }),
      this.jobs.countMatching(userId),
      this.prisma.profileView.findMany({
        where: { seekerId: userId, createdAt: { gte: new Date(now - 30 * DAY) }, recruiter: { employer: { verified: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { createdAt: true, recruiter: { select: { employer: { select: { id: true, slug: true, name: true, logoUrl: true, verified: true } } } } },
      }),
    ]);
    const byEmployer = new Map<string, SeekerProfileInsights['viewers'][number]>();
    for (const v of recent) {
      const e = v.recruiter.employer;
      if (!e) continue;
      const item = byEmployer.get(e.id);
      if (item) item.count += 1;
      else byEmployer.set(e.id, { employer: { ...e, logoUrl: this.assets.url(e.logoUrl) }, count: 1, lastAt: v.createdAt.toISOString() });
    }
    return { views: { last7Days: views7, delta: views7 - viewsPrev }, matchingJobs, viewers: [...byEmployer.values()].slice(0, 6) };
  }
}
