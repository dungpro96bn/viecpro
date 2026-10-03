import { cache } from 'react';
import type { EmployerProfile, HomepageContent, JobDetail, JobListItem, Paginated, RecruiterProfile, RegionDirectoryItem, SystemSettings } from '@viecpro/shared';

// Server (SSR) gọi API qua mạng nội bộ khi chạy Docker (API_INTERNAL_URL=http://api:4000/api/v1); trình duyệt dùng NEXT_PUBLIC_API_BASE_URL
const API_BASE_URL = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// cache(): generateMetadata và trang dùng chung 1 lần gọi trong cùng request (tránh đếm lượt xem 2 lần)
export const getJobDetail = cache((slug: string) => get<JobDetail>(`/jobs/${encodeURIComponent(slug)}`));
export const getSimilarJobs = (slug: string) => get<JobListItem[]>(`/jobs/${encodeURIComponent(slug)}/similar`);
export const getEmployerProfile = cache((slug: string) => get<EmployerProfile>(`/employers/${encodeURIComponent(slug)}`));
export const getRecruiterProfile = cache((slug: string) => get<RecruiterProfile>(`/recruiters/${encodeURIComponent(slug)}`));

export const getProfileJobs = (params: { employer?: string; recruiter?: string }) => {
  const query = new URLSearchParams({ page: '1', limit: '12', sort: 'newest' });
  if (params.employer) query.set('employer', params.employer);
  if (params.recruiter) query.set('recruiter', params.recruiter);
  return get<Paginated<JobListItem>>(`/jobs?${query.toString()}`);
};

/** Danh bạ tỉnh thành theo vùng, kèm số đơn đang tuyển (hero trang chủ) */
export const getRegionDirectory = () => get<RegionDirectoryItem[]>('/regions');

/** Đơn mới nhất – trang chủ dùng để chọn nhà tuyển dụng nổi bật */
export const getLatestJobs = (limit = 50) => get<Paginated<JobListItem>>(`/jobs?page=1&limit=${limit}&sort=newest`);

export const getHomepageContent = cache(() => get<HomepageContent>('/site/homepage'));
export const getSiteSystem = cache(() => get<Pick<SystemSettings, 'supportPhone' | 'supportEmail' | 'maintenanceMode' | 'maintenanceMessage'>>('/site/system'));
