import { normalizeSearch, type JobSearchQuery } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';

/** Bộ lọc tìm kiếm → điều kiện Prisma (chỉ đơn đang tuyển) */
export function buildJobWhere(q: JobSearchQuery): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [{ status: 'open' }];

  if (q.q) {
    // Tìm không dấu trên cột searchText; mỗi từ phải xuất hiện
    for (const word of normalizeSearch(q.q).split(' ')) and.push({ searchText: { contains: word } });
  }
  if (q.pref?.length) and.push({ pref: { in: q.pref } });
  if (q.region?.length) and.push({ region: { in: q.region } });
  if (q.program?.length) and.push({ program: { in: q.program } });
  if (q.industry?.length) and.push({ industry: { in: q.industry } });
  if (q.tag?.length) and.push({ tags: { hasSome: q.tag } });
  if (q.gender) and.push({ gender: { in: [q.gender, 'both'] } });
  if (q.birthYear) and.push({ birthYearFrom: { lte: q.birthYear }, birthYearTo: { gte: q.birthYear } });
  if (q.salaryMin !== undefined || q.salaryMax !== undefined) and.push({ salary: { gte: q.salaryMin, lte: q.salaryMax } });
  if (q.departureWithin) {
    const until = new Date();
    until.setMonth(until.getMonth() + Number(q.departureWithin));
    and.push({ departureAt: { lte: until } });
  }
  if (q.employer) and.push({ employer: { slug: q.employer } });
  if (q.recruiter) and.push({ recruiter: { slug: q.recruiter } });

  return { AND: and };
}

export function buildJobOrder(sort: JobSearchQuery['sort']): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ publishedAt: 'desc' }];
    case 'salary':
      return [{ salary: 'desc' }, { publishedAt: 'desc' }];
    case 'departure':
      return [{ departureAt: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }];
    default:
      // "Phù hợp nhất": tạm xếp theo lượt xem + mới nhất. Thay bằng điểm xếp hạng khi có dữ liệu thật.
      return [{ views: 'desc' }, { publishedAt: 'desc' }];
  }
}

/** Chuỗi tìm kiếm lưu sẵn trên đơn hàng */
export function jobSearchText(job: { title: string; pref: string; industry: string; code: string }): string {
  return normalizeSearch(`${job.title} ${job.pref} ${job.industry} ${job.code}`);
}
