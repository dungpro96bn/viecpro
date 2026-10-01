'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PROGRAM_LABEL,
  SAVED_JOB_SORT_LABEL,
  SAVED_JOB_SORTS,
  WEB_LINKS,
  type Industry,
  type JobListItem,
  type Paginated,
  type SavedJobItem,
  type SavedJobList,
  type SavedJobSort,
  type SavedJobsApplyResult,
} from '@viecpro/shared';
import ApplyButton from '@/components/apply/ApplyButton';
import { useSeekerAccount } from '@/components/seeker/SeekerAccountProvider';
import { IconCheck, IconClock, IconExclaim, IconHeart, IconPin, IconPlus, IconSend, IconSparkle } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';
import { toApplyJob } from '@/lib/data';
import { cx } from '@/lib/format';
import { daysAgo, requirementText } from '@/lib/seeker';
import CompareTable from './CompareTable';

const MAX_COMPARE = 3;
/** Nhóm ngành hiển thị ngắn trên chip lọc */
const SHORT_INDUSTRY: Partial<Record<Industry, string>> = {
  'Điện tử – Lắp ráp': 'Nhà máy',
  'Cơ khí': 'Cơ khí',
  'Chế biến thực phẩm': 'Thực phẩm',
  'Nhà hàng – Khách sạn': 'Nhà hàng',
  'Nông nghiệp': 'Nông nghiệp',
  'Điều dưỡng – Kaigo': 'Điều dưỡng',
  'Xây dựng': 'Xây dựng',
  'Công nghệ thông tin': 'CNTT',
};

/** Việc đã lưu (design 20) */
export default function SavedJobs() {
  const { refresh } = useSeekerAccount();
  const [sort, setSort] = useState<SavedJobSort>('expiring');
  const [industry, setIndustry] = useState<Industry | ''>('');
  const [data, setData] = useState<SavedJobList | null>(null);
  const [error, setError] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [bulk, setBulk] = useState<{ busy: boolean; result: SavedJobsApplyResult | null; error: string }>({ busy: false, result: null, error: '' });
  const [suggested, setSuggested] = useState<JobListItem[]>([]);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ sort, page: '1', limit: '50' });
    if (industry) p.set('industry', industry);
    try {
      setData(await apiRequest<SavedJobList>(`/me/saved-jobs?${p.toString()}`));
      setError('');
    } catch {
      setError('Không tải được việc đã lưu. Vui lòng tải lại trang.');
    }
  }, [sort, industry]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void apiRequest<Paginated<JobListItem>>('/jobs/recommended?page=1&limit=8')
      .then((r) => setSuggested(r.items))
      .catch(() => setSuggested([]));
  }, []);

  const unsave = async (job: SavedJobItem) => {
    setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== job.id), total: d.total - 1 });
    setCompare((c) => c.filter((id) => id !== job.id));
    try {
      await apiRequest<void>(`/me/saved-jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
      void refresh();
      void load();
    } catch (e) {
      setError(apiMessage(e, 'Không bỏ lưu được.'));
      void load();
    }
  };
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]));

  const applyAll = async () => {
    if (!data) return;
    setBulk({ busy: true, result: null, error: '' });
    try {
      const result = await apiRequest<SavedJobsApplyResult>('/me/applications/bulk', { method: 'POST', body: JSON.stringify({ jobIds: data.expiringSoon.map((x) => x.id) }) });
      setBulk({ busy: false, result, error: '' });
      void refresh();
      void load();
    } catch (e) {
      setBulk({ busy: false, result: null, error: apiMessage(e, 'Không ứng tuyển được. Vui lòng thử lại.') });
    }
  };

  const items = data?.items ?? [];
  const compared = items.filter((j) => compare.includes(j.id));
  const total = data?.industries.reduce((n, i) => n + i.count, 0) ?? 0;
  const savedIds = useMemo(() => new Set(items.map((j) => j.id)), [items]);
  const more = suggested.filter((j) => !savedIds.has(j.id)).slice(0, 3);
  const soon = data?.expiringSoon ?? [];

  return (
    <div className="sv">
      <div className="sv-head">
        <span>
          <h1 className="sv-head__title">Việc đã lưu</h1>
          <p className="sv-head__desc">{total} việc đã lưu · danh sách được đồng bộ trên điện thoại và máy tính</p>
        </span>
        <span className="sv-sort" role="radiogroup" aria-label="Sắp xếp">
          {SAVED_JOB_SORTS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={sort === s} className={cx('sv-sort__item', sort === s && 'sv-sort__item--on')} onClick={() => setSort(s)}>
              {SAVED_JOB_SORT_LABEL[s]}
            </button>
          ))}
        </span>
      </div>

      {soon.length > 0 && !bulk.result && (
        <div className="sv-alert" role="status">
          <span className="sv-alert__icon">
            <IconClock size={20} />
          </span>
          <span className="sv-alert__text">
            <b>{soon.length} việc bạn lưu sắp hết hạn nhận hồ sơ</b>
            <small>
              {soon.map((x) => `${x.pref} còn ${x.daysLeft} ngày`).join(' · ')} – ứng tuyển sớm để giữ chỗ phỏng vấn.
            </small>
            {bulk.error && <small className="sv-alert__error">{bulk.error}</small>}
          </span>
          <span className="sv-alert__imgs" aria-hidden="true">
            {soon.slice(0, 3).map((x) => (
              <img key={x.id} src={x.imageUrl} alt="" />
            ))}
          </span>
          <button type="button" className="sv-alert__btn" disabled={bulk.busy} onClick={() => void applyAll()}>
            <IconSend size={15} />
            {bulk.busy ? 'Đang gửi…' : soon.length > 1 ? `Ứng tuyển nhanh cả ${soon.length}` : 'Ứng tuyển nhanh'}
          </button>
        </div>
      )}
      {bulk.result && (
        <div className="sv-alert sv-alert--done" role="status">
          <span className="sv-alert__icon">
            <IconCheck size={20} />
          </span>
          <span className="sv-alert__text">
            <b>Đã gửi {bulk.result.applied.length} hồ sơ bằng thông tin trong hồ sơ của bạn</b>
            <small>
              {bulk.result.skipped.length ? `${bulk.result.skipped.length} việc chưa gửi: ${bulk.result.skipped.map((s) => s.reason).join('; ')}. ` : ''}
              Theo dõi tiến trình ở <Link href={WEB_LINKS.seekerApplications}>Việc đã ứng tuyển</Link>.
            </small>
          </span>
        </div>
      )}

      <div className="sv-filters">
        <div className="sv-chips" role="tablist" aria-label="Lọc theo ngành">
          <button type="button" role="tab" aria-selected={!industry} className={cx('sv-chip', !industry && 'sv-chip--on')} onClick={() => setIndustry('')}>
            Tất cả <span>{total}</span>
          </button>
          {data?.industries.map((i) => (
            <button key={i.industry} type="button" role="tab" aria-selected={industry === i.industry} className={cx('sv-chip', industry === i.industry && 'sv-chip--on')} title={i.industry} onClick={() => setIndustry(i.industry)}>
              {SHORT_INDUSTRY[i.industry] ?? i.industry} <span>{i.count}</span>
            </button>
          ))}
        </div>
        {/* Chưa có API: danh sách lưu tuỳ chỉnh (thư mục việc đã lưu) */}
        <button type="button" className="sv-new-list" disabled title="Sắp ra mắt">
          <IconPlus size={14} />
          Tạo danh sách
        </button>
      </div>

      {error && (
        <p className="sv-error" role="alert">
          {error}
        </p>
      )}

      {data && !items.length && (
        <div className="sv-empty">
          <IconHeart size={26} />
          <b>{industry ? 'Không có việc đã lưu ở ngành này' : 'Bạn chưa lưu việc nào'}</b>
          <span>Bấm biểu tượng trái tim trên thẻ việc làm để lưu và so sánh sau.</span>
          <Link href="/tim-kiem" className="btn btn--primary btn--sm">
            Tìm việc làm
          </Link>
        </div>
      )}

      <ul className="sv-grid">
        {items.map((j) => (
          <SavedCard key={j.id} job={j} comparing={compare.includes(j.id)} compareFull={compare.length >= MAX_COMPARE} onCompare={() => toggleCompare(j.id)} onUnsave={() => void unsave(j)} />
        ))}
      </ul>

      {compared.length >= 2 && <CompareTable jobs={compared} onClear={() => setCompare([])} />}
      {compare.length === 1 && <p className="sv-hint">Chọn thêm 1 – 2 việc để so sánh (tối đa {MAX_COMPARE}).</p>}

      {more.length > 0 && (
        <section className="sv-more" aria-labelledby="sv-more-title">
          <span className="sv-more__head">
            <h2 id="sv-more-title">
              <IconSparkle size={16} />
              Có thể bạn cũng thích
              <small>dựa trên các việc bạn đã lưu</small>
            </h2>
            <Link href="/tim-kiem">Xem thêm</Link>
          </span>
          <ul className="sv-more__list">
            {more.map((j) => (
              <li key={j.id}>
                <Link href={`/viec-lam/${j.slug}`} className="sv-mini">
                  <img src={j.imageUrl} alt="" />
                  <span>
                    <b>{j.title}</b>
                    <small>
                      <strong>{j.salary.toLocaleString('vi-VN')} ¥</strong>
                      {j.matchScore !== undefined && <em>Phù hợp {j.matchScore}%</em>}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Thẻ việc đã lưu ---------- */
function SavedCard({ job, comparing, compareFull, onCompare, onUnsave }: { job: SavedJobItem; comparing: boolean; compareFull: boolean; onCompare: () => void; onUnsave: () => void }) {
  const view = apiJobToView(job);
  const apply = toApplyJob(view, job.employer?.name, apiRecruiterToPoster(job));
  const score = job.matchScore ?? 0;
  return (
    <li className={cx('sv-card', comparing && 'sv-card--compare', !job.eligible && 'sv-card--muted')}>
      <div className="sv-card__media">
        <Link href={`/viec-lam/${job.slug}`} tabIndex={-1} aria-hidden="true">
          <img src={job.imageUrl} alt="" />
        </Link>
        {job.highlight && <span className={cx('sv-flag', `sv-flag--${job.highlight.kind}`)}>{job.highlight.text}</span>}
        <button type="button" className="sv-heart" aria-label={`Bỏ lưu ${job.title}`} onClick={onUnsave}>
          <IconHeart size={16} />
        </button>
        <button type="button" role="checkbox" aria-checked={comparing} disabled={!comparing && compareFull} className={cx('sv-compare', comparing && 'sv-compare--on')} onClick={onCompare}>
          <span className="sv-compare__box">{comparing && <IconCheck size={10} />}</span>
          So sánh
        </button>
        <span className="sv-saved-at">Lưu {daysAgo(job.savedAt)}</span>
      </div>
      <div className="sv-card__body">
        <Link href={`/viec-lam/${job.slug}`} className="sv-card__title">
          {job.title}
        </Link>
        <span className="sv-card__where">
          <IconPin size={12} />
          {job.pref}, Nhật Bản · {PROGRAM_LABEL[job.program]}
        </span>
        <span className="sv-card__row">
          <b className="sv-card__salary">
            {job.salary.toLocaleString('vi-VN')} ¥<small>/tháng</small>
          </b>
          <span className={cx('sv-match', score >= 80 ? 'sv-match--high' : score >= 60 ? 'sv-match--mid' : 'sv-match--low')}>Phù hợp {score}%</span>
        </span>
        <span className="sv-tags">
          <span>{job.feeUsd === 0 ? 'Miễn phí xuất cảnh' : job.feeUsd ? `Phí ${job.feeUsd.toLocaleString('vi-VN')} USD` : 'Phí: liên hệ'}</span>
          {job.contractYears && <span>HĐ {job.contractYears} năm</span>}
          <span>{requirementText(job)}</span>
        </span>
        <span className={cx('sv-note', job.matchNote.ok ? 'sv-note--ok' : 'sv-note--warn')}>
          {job.matchNote.ok ? <IconCheck size={12} /> : <IconExclaim size={12} />}
          {job.matchNote.text}
        </span>
        <span className="sv-card__actions">
          {job.applied ? (
            <span className="sv-btn sv-btn--done">
              <IconCheck size={14} />
              Đã ứng tuyển
            </span>
          ) : job.eligible ? (
            <ApplyButton job={apply} className="sv-btn sv-btn--primary">
              <IconSend size={14} />
              Ứng tuyển 1 chạm
            </ApplyButton>
          ) : (
            <span className="sv-btn sv-btn--disabled">
              <IconExclaim size={14} />
              Không đủ điều kiện
            </span>
          )}
          <Link href={`/viec-lam/${job.slug}`} className="sv-btn sv-btn--outline">
            Chi tiết
          </Link>
        </span>
      </div>
    </li>
  );
}
