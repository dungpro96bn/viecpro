'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SEEKER_APPLICATION_STATUS_LABEL,
  SEEKER_APPLICATION_STEP_LABEL,
  SEEKER_APPLICATION_TAB_LABEL,
  SEEKER_APPLICATION_TABS,
  type ApplicationItem,
  type ApplicationStatus,
  type SeekerApplicationList,
  type SeekerApplicationSummary,
  type SeekerApplicationTab,
} from '@viecpro/shared';
import { useSeekerAccount } from '@/components/seeker/SeekerAccountProvider';
import Select from '@/components/ui/Select';
import { IconArrowRight, IconCalendar, IconChat, IconCheck, IconChevronDown, IconChevronUp, IconClock, IconPhone, IconSearch, IconTrendUp, IconZaloApp } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, hourMinute, telHref, weekdayShort, zaloHref } from '@/lib/employer';
import { cx } from '@/lib/format';
import { countdown } from '@/lib/seeker';
import InterviewHero from './InterviewHero';

type Sort = 'updated' | 'applied';
const PAGE = 10;

/** Dòng lịch sử: phần trước " – " là sự kiện, phần sau là lời nhắn của cán bộ */
const DEFAULT_EVENT: Record<ApplicationStatus, string> = {
  submitted: 'Ứng tuyển',
  viewed: 'Cán bộ đã xem hồ sơ',
  interview: 'Hẹn phỏng vấn',
  passed: 'Trúng tuyển',
  departed: 'Đã xuất cảnh',
  rejected: 'Hồ sơ chưa phù hợp',
  withdrawn: 'Bạn đã rút hồ sơ',
};
const eventText = (status: ApplicationStatus, note: string | null) => note?.split(' – ')[0] ?? DEFAULT_EVENT[status];
const messageOf = (note: string) => (note.includes(' – ') ? note.split(' – ').slice(1).join(' – ') : note);
const stripCongrats = (note: string | null) => note?.replace(/^Chúc mừng bạn!\s*/, '') ?? null;
const dateTime = (iso: string) => `${dayMonth(iso, true)}, ${hourMinute(iso)}`;

/** Việc đã ứng tuyển (design 19) */
export default function AppliedJobs() {
  const { refresh } = useSeekerAccount();
  const [summary, setSummary] = useState<SeekerApplicationSummary | null>(null);
  const [data, setData] = useState<SeekerApplicationList | null>(null);
  const [tab, setTab] = useState<SeekerApplicationTab>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const loadSummary = useCallback(() => apiRequest<SeekerApplicationSummary>('/me/applications/summary').then(setSummary), []);
  useEffect(() => {
    void loadSummary().catch(() => setError('Không tải được số liệu hồ sơ.'));
  }, [loadSummary]);

  useEffect(() => {
    const p = new URLSearchParams({ tab, sort, page: '1', limit: String(limit) });
    if (q.trim()) p.set('q', q.trim());
    const t = setTimeout(() => {
      apiRequest<SeekerApplicationList>(`/me/applications?${p.toString()}`)
        .then((list) => {
          setData(list);
          // Mở sẵn hồ sơ có lịch phỏng vấn sắp tới
          setOpen((o) => (o.size ? o : new Set(list.items.filter((a) => a.interview).map((a) => a.id))));
          setError('');
        })
        .catch(() => setError('Không tải được danh sách hồ sơ. Vui lòng tải lại trang.'));
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [tab, q, sort, limit]);

  const replace = (item: ApplicationItem) => {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === item.id ? item : x)) });
    setSummary((s) => s && s.nextInterview?.id === item.id ? { ...s, nextInterview: item } : s);
  };
  const withdraw = async (a: ApplicationItem) => {
    if (!window.confirm(`Rút hồ sơ ứng tuyển "${a.job.title}"? Cán bộ sẽ không liên hệ cho đơn này nữa.`)) return;
    try {
      replace(await apiRequest<ApplicationItem>(`/me/applications/${encodeURIComponent(a.id)}/withdraw`, { method: 'POST' }));
      void loadSummary();
      void refresh();
    } catch (e) {
      window.alert(apiMessage(e, 'Không rút được hồ sơ.'));
    }
  };
  const toggle = (id: string) => setOpen((o) => new Set(o.has(id) ? [...o].filter((x) => x !== id) : [...o, id]));

  const next = summary?.nextInterview;
  const nextAt = next?.interview?.startAt;
  const stats = summary && [
    { label: 'Đang xử lý', value: summary.processing, note: summary.avgResponseHours ? `Cán bộ phản hồi TB ${summary.avgResponseHours} giờ` : 'Cán bộ sẽ sớm liên hệ', tone: 'blue', icon: <IconClock size={15} /> },
    { label: 'Phỏng vấn sắp tới', value: summary.upcomingInterviews, note: nextAt ? `${weekdayShort(new Date(nextAt))}, ${dayMonth(nextAt, true)} · ${hourMinute(nextAt)}` : 'Chưa có lịch', tone: 'orange', icon: <IconCalendar size={15} /> },
    { label: 'Trúng tuyển', value: summary.passed, note: summary.latestPassed ? [summary.latestPassed.pref, stripCongrats(summary.latestPassed.note)].filter(Boolean).join(' · ') : 'Cố lên nhé!', tone: 'green', icon: <IconCheck size={15} /> },
    { label: 'Tỉ lệ được mời PV', value: summary.inviteRate === null ? '–' : `${summary.inviteRate}%`, note: summary.betterThan !== null ? `Cao hơn ${summary.betterThan}% ứng viên` : 'Hoàn thiện hồ sơ để tăng tỉ lệ', tone: 'violet', icon: <IconTrendUp size={15} /> },
  ];

  return (
    <div className="ap">
      <div className="ap-head">
        <span>
          <h1 className="ap-head__title">Việc đã ứng tuyển</h1>
          <p className="ap-head__desc">Theo dõi từng bước từ lúc gửi hồ sơ đến ngày xuất cảnh.</p>
        </span>
        <span className="ap-sort">
          <Select
            className="field-input field-input--select"
            aria-label="Sắp xếp"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { value: 'updated', label: 'Cập nhật gần nhất' },
              { value: 'applied', label: 'Ngày ứng tuyển' },
            ]}
          />
        </span>
      </div>

      {stats && (
        <div className="ap-stats">
          {stats.map((s) => (
            <div key={s.label} className="ap-stat">
              <span className="ap-stat__top">
                <span className="ap-stat__label">{s.label}</span>
                <span className={cx('ap-stat__icon', `ap-stat__icon--${s.tone}`)}>{s.icon}</span>
              </span>
              <b className="ap-stat__value">{s.value}</b>
              <small className={cx('ap-stat__note', `ap-stat__note--${s.tone}`)}>{s.note}</small>
            </div>
          ))}
        </div>
      )}

      {next?.interview && <InterviewHero item={next} onChange={replace} />}

      <div className="ap-filters">
        <div className="ap-tabs" role="tablist" aria-label="Lọc hồ sơ">
          {SEEKER_APPLICATION_TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={cx('ap-tab', tab === t && 'ap-tab--on')} onClick={() => (setTab(t), setLimit(PAGE))}>
              {SEEKER_APPLICATION_TAB_LABEL[t]}
              <span className="ap-tab__count">{data?.counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="ap-search">
          <IconSearch size={14} />
          <input value={q} maxLength={80} placeholder="Tìm theo tên đơn…" aria-label="Tìm theo tên đơn" onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} />
        </label>
      </div>

      {error && (
        <p className="ap-error" role="alert">
          {error}
        </p>
      )}

      {data && !data.items.length && (
        <div className="ap-empty">
          <b>{q ? 'Không có hồ sơ khớp từ khoá' : tab === 'all' ? 'Bạn chưa ứng tuyển đơn nào' : `Chưa có hồ sơ ở mục “${SEEKER_APPLICATION_TAB_LABEL[tab]}”`}</b>
          <Link href="/tim-kiem" className="btn btn--primary btn--sm">
            Tìm việc phù hợp
          </Link>
        </div>
      )}

      <ul className="ap-list">
        {data?.items.map((a) => (
          <ApplicationCard key={a.id} a={a} expanded={open.has(a.id)} onToggle={() => toggle(a.id)} onWithdraw={() => void withdraw(a)} avgHours={summary?.avgResponseHours ?? null} />
        ))}
      </ul>

      {data?.hasMore && (
        <button type="button" className="btn btn--outline btn--sm ap-more" onClick={() => setLimit((l) => Math.min(50, l + PAGE))}>
          Xem thêm hồ sơ
        </button>
      )}
    </div>
  );
}

/* ---------- Thẻ hồ sơ ---------- */
function ApplicationCard({ a, expanded, onToggle, onWithdraw, avgHours }: { a: ApplicationItem; expanded: boolean; onToggle: () => void; onWithdraw: () => void; avgHours: number | null }) {
  const iv = a.interview;
  const closed = a.status === 'rejected' || a.status === 'withdrawn';
  const history = [...a.timeline].reverse();
  const message = a.latestNote && a.status !== 'rejected' ? messageOf(a.latestNote.text) : null;

  const footer = (() => {
    if (iv) return { tone: 'orange', icon: <IconClock size={14} />, text: `Phỏng vấn ${countdown(iv.startAt).replace('Còn', 'sau').toLowerCase()}` };
    if (a.status === 'passed' || a.status === 'departed') return { tone: 'green', icon: <IconCheck size={14} />, text: stripCongrats(a.latestNote?.text ?? null) ?? 'Cán bộ sẽ hướng dẫn thủ tục tiếp theo' };
    if (a.status === 'viewed') return { tone: 'muted', icon: <IconClock size={14} />, text: a.latestNote ? eventText('viewed', a.latestNote.text) : 'Cán bộ đã xem hồ sơ, sẽ sớm liên hệ' };
    if (a.status === 'submitted') return { tone: 'muted', icon: <IconClock size={14} />, text: avgHours ? `Thường phản hồi trong ${avgHours <= 24 ? `${avgHours} giờ` : `${Math.round(avgHours / 24)} ngày`}` : 'Thường phản hồi trong 1 ngày' };
    return null;
  })();

  return (
    <li className={cx('ap-card', expanded && 'ap-card--open')}>
      <div className="ap-card__top">
        {a.job.removed ? (
          <span className="ap-card__img">
            <img src={a.job.imageUrl} alt="" />
          </span>
        ) : (
          <Link href={`/viec-lam/${a.job.slug}`} className="ap-card__img">
            <img src={a.job.imageUrl} alt="" />
          </Link>
        )}
        <span className="ap-card__info">
          {a.job.removed ? (
            <span className="ap-card__title">
              {a.job.title} <small className="ap-card__removed">Tin đã bị gỡ</small>
            </span>
          ) : (
            <Link href={`/viec-lam/${a.job.slug}`} className="ap-card__title">
              {a.job.title}
            </Link>
          )}
          <span className="ap-card__meta">
            {a.job.employerName && <span>{a.job.employerName}</span>}
            <span>{a.job.pref}, Nhật Bản</span>
            <b>{a.job.salary.toLocaleString('vi-VN')} ¥/tháng</b>
          </span>
          <small className="ap-card__sub">
            Ứng tuyển {dayMonth(a.createdAt, true)}
            {a.code && ` · mã hồ sơ ${a.code}`}
          </small>
        </span>
        <span className="ap-card__status">
          <span className={cx('ap-badge', `ap-badge--${a.status}`)}>{SEEKER_APPLICATION_STATUS_LABEL[a.status]}</span>
          {iv && <b className="ap-card__when">{`${dayMonth(iv.startAt, true)} · ${hourMinute(iv.startAt)}`}</b>}
          {a.status === 'passed' && <b className="ap-card__when ap-card__when--green">Chúc mừng bạn!</b>}
        </span>
      </div>

      {a.steps && (
        <ol className="ap-steps" aria-label="Tiến trình hồ sơ">
          {a.steps.map((s) => (
            <li key={s.key} className={cx('ap-step', `ap-step--${s.state}`)}>
              <span className="ap-step__bar" />
              <span className="ap-step__label">
                <span>{SEEKER_APPLICATION_STEP_LABEL[s.key]}</span>
                {s.at && <small>{dayMonth(s.at, true)}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {expanded && (
        <div className="ap-detail">
          <div className="ap-history">
            <b className="ap-history__title">Lịch sử hồ sơ</b>
            <ol>
              {history.map((e, i) => (
                <li key={`${e.status}-${e.createdAt}`} className={cx(i === 0 && !closed && 'ap-history__now')}>
                  <span>{e.status === 'interview' && a.interviewAt && !e.note ? `Hẹn phỏng vấn ${hourMinute(a.interviewAt)}, ${dayMonth(a.interviewAt, true)}` : eventText(e.status, e.note)}</span>
                  <small>{dateTime(e.createdAt)}</small>
                </li>
              ))}
            </ol>
          </div>
          {a.consultant && (
            <div className="ap-consultant">
              <span className="ap-consultant__who">
                <span className="ap-consultant__photo">{a.consultant.photoUrl ? <img src={a.consultant.photoUrl} alt="" /> : a.consultant.name.charAt(0)}</span>
                <span>
                  <b>{a.consultant.name}</b>
                  <small>Cán bộ phụ trách đơn</small>
                </span>
              </span>
              {message && <p className="ap-consultant__msg">{message}</p>}
              {a.consultant.phone ? (
                <span className="ap-consultant__actions">
                  <a href={zaloHref(a.consultant.phone)} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm">
                    <IconZaloApp size={14} />
                    Nhắn
                  </a>
                  <a href={telHref(a.consultant.phone)} className="btn btn--outline btn--sm">
                    <IconPhone size={14} />
                    Gọi
                  </a>
                </span>
              ) : (
                <Link href={`/tu-van-vien/${a.consultant.slug}`} className="btn btn--outline btn--sm">
                  Xem hồ sơ cán bộ
                </Link>
              )}
            </div>
          )}
          {a.status === 'departed' && <DepartureReview applicationId={a.id} review={a.review ?? null} />}
        </div>
      )}

      <div className="ap-card__foot">
        {closed ? (
          a.status === 'rejected' && a.job.industry ? (
            <Link href={`/tim-kiem?industry=${encodeURIComponent(a.job.industry)}`} className="ap-foot__note ap-foot__note--link">
              <IconArrowRight size={14} />
              Xem đơn tương tự đang tuyển
            </Link>
          ) : (
            <span className="ap-foot__note">{a.status === 'withdrawn' ? 'Bạn đã rút hồ sơ này' : 'Hồ sơ đã đóng'}</span>
          )
        ) : (
          footer && (
            <span className={cx('ap-foot__note', `ap-foot__note--${footer.tone}`)}>
              {footer.icon}
              {footer.text}
            </span>
          )
        )}
        {a.withdrawable && (
          <button type="button" className="ap-foot__withdraw" onClick={onWithdraw}>
            Rút hồ sơ
          </button>
        )}
        {a.conversationId && <Link className="ap-foot__message" href={`/tai-khoan-ung-vien/tin-nhan?id=${encodeURIComponent(a.conversationId)}`}><IconChat size={14} />Tin nhắn ({a.unreadMessages ?? 0})</Link>}
        <button type="button" className="ap-foot__toggle" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? 'Thu gọn' : 'Chi tiết'}
          {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </button>
      </div>
    </li>
  );
}

function DepartureReview({ applicationId, review }: { applicationId: string; review: ApplicationItem['review'] }) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(!!review);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (saved) return <p className="ap-review__saved" role="status">Cảm ơn bạn đã đánh giá cán bộ phụ trách · {rating}/5 sao</p>;
  return (
    <form
      className="ap-review"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (!rating) return setError('Chọn số sao trước khi gửi.');
        if (comment.trim().length < 10) return setError('Đánh giá cần ít nhất 10 ký tự.');
        setBusy(true);
        setError('');
        try {
          await apiRequest(`/me/applications/${encodeURIComponent(applicationId)}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
          setSaved(true);
        } catch (e) {
          setError(apiMessage(e, 'Chưa gửi được đánh giá. Vui lòng thử lại.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <b>Chia sẻ trải nghiệm sau khi xuất cảnh</b>
      <span className="ap-review__hint">Đánh giá chỉ dành cho hồ sơ đã xuất cảnh qua viecpro. Nội dung sẽ hiển thị công khai, không kèm tên và thông tin liên hệ của bạn.</span>
      <span className="ap-review__stars" role="radiogroup" aria-label="Số sao đánh giá">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} sao`} className={cx('ap-review__star', rating >= value && 'ap-review__star--on')} onClick={() => (setRating(value), setError(''))}>★</button>
        ))}
      </span>
      <label className="ap-review__label" htmlFor={`review-${applicationId}`}>Nội dung đánh giá</label>
      <textarea id={`review-${applicationId}`} value={comment} maxLength={1500} rows={3} onChange={(event) => (setComment(event.target.value), setError(''))} placeholder="Chia sẻ về cách tư vấn, hỗ trợ và quy trình xuất cảnh…" />
      {error && <span className="ap-review__error" role="alert">{error}</span>}
      <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
    </form>
  );
}
