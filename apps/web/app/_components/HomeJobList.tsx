'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import JobCard from '@/components/jobs/JobCard';
import { IconArrowRight } from '@/components/ui/Icons';
import Select from '@/components/ui/Select';
import { toApplyJob } from '@/lib/data';
import { cx } from '@/lib/format';
import type { Program } from '@/lib/types';
import type { JobFacets, JobListItem, Paginated } from '@viecpro/shared';
import { apiMessage, apiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';
import type { Job, Poster } from '@/lib/types';

const TABS: Array<{ key: 'all' | Program; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'tts', label: 'Thực tập sinh' },
  { key: 'tok', label: 'Kỹ năng đặc định' },
  { key: 'ks', label: 'Kỹ sư' },
];

/** Danh sách 20 việc làm mới nhất, lọc theo chương trình */
export default function HomeJobList() {
  const [program, setProgram] = useState<'all' | Program>('all');
  const [sort, setSort] = useState('Mới nhất');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [posters, setPosters] = useState<Record<string, Poster>>({});
  const [facets, setFacets] = useState<JobFacets | null>(null);
  const [error, setError] = useState('');
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Chờ khôi phục phiên đăng nhập để API trả đúng cờ "đã lưu"
    if (authLoading) return;
    let active = true;
    const params = new URLSearchParams({ page: '1', limit: '20', sort: sort === 'Lương cao nhất' ? 'salary' : sort === 'Xem nhiều nhất' ? 'relevance' : 'newest' });
    if (program !== 'all') params.set('program', program);
    void apiRequest<Paginated<JobListItem>>(`/jobs?${params.toString()}`)
      .then((result) => {
        if (!active) return;
        setJobs(result.items.map(apiJobToView));
        setPosters(Object.fromEntries(result.items.map((item) => [item.recruiter.id, apiRecruiterToPoster(item)])));
        setError('');
      })
      .catch((cause: unknown) => { if (active) { setJobs([]); setError(apiMessage(cause, 'Không thể tải việc làm.')); } });
    return () => { active = false; };
  }, [program, sort, authLoading, user?.id]);

  useEffect(() => {
    void apiRequest<JobFacets>('/jobs/facets').then(setFacets).catch(() => setFacets(null));
  }, []);

  const countOf = (key: 'all' | Program) => key === 'all' ? facets?.total ?? 0 : facets?.programs[key] ?? 0;

  return (
    <div className="home-jobs">
      <div className="home-jobs__head">
        <h2 className="home-jobs__title">Việc làm Nhật Bản mới nhất</h2>
        <label className="sort-select">
          Sắp xếp
          <Select className="field-input field-input--select sort-select__control" aria-label="Sắp xếp" options={['Mới nhất', 'Lương cao nhất', 'Xem nhiều nhất']} value={sort} onChange={setSort} />
        </label>
      </div>

      <div className="pill-tabs" role="tablist" aria-label="Lọc theo chương trình">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={program === t.key}
            className={cx('pill-tab', program === t.key && 'pill-tab--active')}
            onClick={() => setProgram(t.key)}
          >
            {t.label} <span className="count-pill">{countOf(t.key)}</span>
          </button>
        ))}
      </div>

      <div className="job-list">
        {error ? <p role="status">{error}</p> : jobs.map((job) => (
          <JobCard key={job.id} job={job} poster={posters[job.posterId]} applyJob={toApplyJob(job, undefined, posters[job.posterId])} />
        ))}
      </div>

      <div className="home-jobs__more">
        <Link href="/tim-kiem" className="btn btn--outline btn--pill home-jobs__more-btn">
          Xem tất cả việc làm Nhật Bản
          <IconArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
