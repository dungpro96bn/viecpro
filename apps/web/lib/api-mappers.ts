import type { JobListItem } from '@viecpro/shared';
import type { SliderJob } from './job-detail';
import type { Job, Poster } from './types';

export function apiJobToView(job: JobListItem): Job {
  const postedAt = job.publishedAt ? new Date(job.publishedAt) : new Date();
  const hours = Math.max(0, Math.floor((Date.now() - postedAt.getTime()) / 3_600_000));
  const posted = hours < 1 ? 'Vừa đăng' : hours < 24 ? `${hours} giờ trước` : `${Math.floor(hours / 24)} ngày trước`;
  return {
    id: job.id, slug: job.slug, img: job.imageUrl, pref: job.pref, region: job.region, program: job.program,
    title: job.title, salary: job.salary, qty: job.quantityText,
    age: `${job.birthYearFrom}–${job.birthYearTo}`, views: job.views, tags: job.tags, badges: job.badges,
    posterId: job.recruiter.id, posted,
    saved: job.saved,
  };
}

export function apiRecruiterToPoster(job: JobListItem): Poster {
  return {
    id: job.recruiter.id, name: job.recruiter.name, role: job.recruiter.title,
    photo: job.recruiter.photoUrl ?? undefined, rating: job.recruiter.rating,
    city: job.recruiter.city ?? '', href: `/tu-van-vien/${job.recruiter.slug}`,
  };
}

export function apiJobToSlider(job: JobListItem): SliderJob {
  return {
    href: `/viec-lam/${job.slug}`,
    img: job.imageUrl,
    pref: job.pref,
    program: job.program,
    title: job.title,
    salary: job.salary,
    qty: job.quantityText,
    age: `${job.birthYearFrom}–${job.birthYearTo}`,
    poster: { name: job.recruiter.name, photo: job.recruiter.photoUrl ?? undefined, rating: job.recruiter.rating },
    posted: job.publishedAt ? new Date(job.publishedAt).toLocaleDateString('vi-VN') : 'Đang cập nhật',
    badge: job.badges[0] ?? 'new',
  };
}
