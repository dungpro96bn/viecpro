'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  APPLICANT_STAGE_LABEL,
  APPLICANT_STAGES,
  APPLICATION_SOURCE_LABEL,
  APPLICATION_STATUS_LABEL,
  DEPART_WITHIN_LABEL,
  EDUCATION_LABEL,
  MARITAL_LABEL,
  PASSPORT_LABEL,
  type ApplicantNoteItem,
  type ApplicantQuickFilter,
  type ApplicantStage,
  type ApplicationStatus,
  type EducationLevel,
  type EmployerApplicantDetail,
  type EmployerApplicantItem,
  type EmployerApplicantList,
  type MaritalStatus,
  type PassportStatus,
} from '@viecpro/shared';
import ApplicantAvatar from '@/components/employer/ApplicantAvatar';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import MatchBadge from '@/components/employer/MatchBadge';
import Pager from '@/components/employer/Pager';
import Select from '@/components/ui/Select';
import { IconCalendar, IconChatSquare, IconCheck, IconDownload, IconExclaim, IconPhone, IconPlus, IconSearch } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, decimal, hourMinute, maskPhone, telHref, timeAgo, zaloHref } from '@/lib/employer';
import { cx, formatNumber } from '@/lib/format';

const PER_PAGE = 14;
const GENDER_SHORT = { nam: 'Nam', nu: 'Nữ' } as const;
const QUICK: Array<{ key: ApplicantQuickFilter; label: string }> = [
  { key: 'unseen', label: 'Chưa xem' },
  { key: 'passport', label: 'Có hộ chiếu' },
  { key: 'match90', label: 'Phù hợp ≥ 90%' },
  { key: 'overdue', label: 'Chờ quá 24 giờ' },
];
/** Nút bước tuyển dụng → trạng thái gửi API */
const STEP_STATUS: Record<ApplicantStage, ApplicationStatus | null> = { new: null, contacted: 'viewed', interview: 'interview', passed: 'passed', rejected: 'rejected' };
const STEP_LABEL: Record<ApplicantStage, string> = { new: 'Mới', contacted: 'Liên hệ', interview: 'Phỏng vấn', passed: 'Trúng tuyển', rejected: 'Loại' };

/** Quản lý ứng viên (design 13) */
export default function ApplicantsManager() {
  const { refresh: refreshAccount } = useEmployerAccount();
  const [stage, setStage] = useState<ApplicantStage | ''>('');
  const [jobId, setJobId] = useState('');
  const [minMatch, setMinMatch] = useState('');
  const [quick, setQuick] = useState<ApplicantQuickFilter | ''>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<EmployerApplicantList | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Bộ lọc từ đường dẫn (dashboard, thanh tìm kiếm, trang tin tuyển dụng)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const initialQ = p.get('q') ?? '';
    setQ(initialQ);
    setQuery(initialQ);
    setJobId(p.get('job') ?? '');
    const qk = p.get('quick');
    if (qk && QUICK.some((x) => x.key === qk)) setQuick(qk as ApplicantQuickFilter);
    setSelectedId(p.get('id'));
    setReady(true);
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
    if (stage) p.set('stage', stage);
    if (jobId) p.set('jobId', jobId);
    if (minMatch) p.set('minMatch', minMatch);
    if (quick) p.set('quick', quick);
    if (query) p.set('q', query);
    return p;
  }, [page, stage, jobId, minMatch, quick, query]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    apiRequest<EmployerApplicantList>(`/employer/applications?${params.toString()}`)
      .then((data) => {
        if (!active) return;
        setList(data);
        setError('');
        setSelectedId((id) => id ?? data.items[0]?.id ?? null);
      })
      .catch((e: unknown) => active && setError(apiMessage(e, 'Không tải được danh sách ứng viên.')));
    return () => {
      active = false;
    };
  }, [params, ready, reloadKey]);

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  /** Cập nhật một dòng trong danh sách sau khi thao tác ở bảng chi tiết */
  const patchItem = useCallback((id: string, patch: Partial<EmployerApplicantItem>) => {
    setList((l) => (l ? { ...l, items: l.items.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : l));
  }, []);

  const onChanged = useCallback(async () => {
    setReloadKey((k) => k + 1);
    await refreshAccount();
  }, [refreshAccount]);

  const items = list?.items ?? [];
  const counts = list?.stageCounts;
  const notes = list?.stageNotes;
  const stageCards: Array<{ key: ApplicantStage | ''; label: string; note: string; warn?: boolean }> = [
    { key: '', label: 'Tất cả', note: `trong ${list?.jobs.length ?? 0} đơn` },
    { key: 'new', label: APPLICANT_STAGE_LABEL.new, note: `${notes?.unseen ?? 0} chưa xem`, warn: !!notes?.unseen },
    { key: 'contacted', label: APPLICANT_STAGE_LABEL.contacted, note: notes?.avgContactHours !== null && notes ? `TB ${decimal(notes.avgContactHours ?? 0)} giờ` : 'Chưa có số liệu' },
    { key: 'interview', label: APPLICANT_STAGE_LABEL.interview, note: `${notes?.interviewsThisWeek ?? 0} lịch tuần này` },
    { key: 'passed', label: APPLICANT_STAGE_LABEL.passed, note: `Tỉ lệ ${notes?.passRate ?? 0}%` },
    { key: 'rejected', label: APPLICANT_STAGE_LABEL.rejected, note: 'Lưu kho hồ sơ' },
  ];

  return (
    <div className="appl-page">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Ứng viên</span>
          </nav>
          <h1 className="emp-page-head__title">Ứng viên</h1>
        </span>
        <span className="emp-page-head__actions">
          <button type="button" className="emp-btn appl-head-btn" onClick={() => void exportCsv(params)}>
            <IconDownload size={16} />
            Xuất Excel
          </button>
          <Link href={`${EMPLOYER_BASE}/ung-vien/them`} className="emp-btn emp-btn--primary appl-head-btn">
            <IconPlus size={17} className="icon--w24" />
            Thêm ứng viên
          </Link>
        </span>
      </div>

      <div className="appl-stages" role="radiogroup" aria-label="Bước tuyển dụng">
        {stageCards.map((c) => (
          <button key={c.label} type="button" role="radio" aria-checked={stage === c.key} className={cx('appl-stage', stage === c.key && 'appl-stage--active')} onClick={() => change(setStage)(c.key)}>
            <span className="appl-stage__label">
              <span className={cx('appl-stage__dot', `appl-stage__dot--${c.key || 'all'}`)} />
              {c.label}
            </span>
            <span className="appl-stage__row">
              <span className="appl-stage__count">{formatNumber(c.key ? (counts?.[c.key] ?? 0) : (counts?.all ?? 0))}</span>
              <span className={cx('appl-stage__note', c.warn && 'appl-stage__note--warn')}>{c.note}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="appl-layout">
        <div className="emp-card appl-table">
          <form
            className="appl-filters"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              change(setQuery)(q.trim());
            }}
          >
            <label className="emp-find">
              <IconSearch size={16} />
              <input className="emp-find__input" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== query && change(setQuery)(q.trim())} placeholder="Tìm tên, số điện thoại, quê quán…" aria-label="Tìm ứng viên" />
            </label>
            <span className="appl-filter appl-filter--job">
              <Select
                className="field-input field-input--select emp-filter__select"
                aria-label="Đơn tuyển"
                value={jobId}
                onChange={(v) => change(setJobId)(v)}
                options={[{ value: '', label: `Tất cả đơn tuyển (${list?.jobs.length ?? 0})` }, ...(list?.jobs ?? []).map((j) => ({ value: j.id, label: j.shortTitle }))]}
              />
            </span>
            <span className="appl-filter">
              <Select
                className="field-input field-input--select emp-filter__select"
                aria-label="Mức phù hợp"
                value={minMatch}
                onChange={(v) => change(setMinMatch)(v)}
                options={[
                  { value: '', label: 'Mọi mức phù hợp' },
                  { value: '90', label: 'Từ 90% trở lên' },
                  { value: '80', label: 'Từ 80% trở lên' },
                  { value: '70', label: 'Từ 70% trở lên' },
                ]}
              />
            </span>
          </form>
          <div className="appl-quick" role="group" aria-label="Lọc nhanh">
            <span className="appl-quick__label">Lọc nhanh</span>
            {QUICK.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={quick === f.key}
                className={cx('appl-chip', f.key === 'overdue' && 'appl-chip--warn', quick === f.key && 'appl-chip--active')}
                onClick={() => change(setQuick)(quick === f.key ? '' : f.key)}
              >
                {f.label}
                <span className="appl-chip__count">{formatNumber(list?.quickCounts[f.key] ?? 0)}</span>
              </button>
            ))}
          </div>

          <div className="appl-grid appl-grid--head" role="row">
            <span>Ứng viên</span>
            <span>Đơn ứng tuyển</span>
            <span>Phù hợp</span>
            <span>Bước</span>
            <span className="appl-grid__right">Ứng tuyển</span>
          </div>
          {items.map((a) => (
            <ApplicantRow key={a.id} a={a} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)} />
          ))}
          {list && !items.length && <p className="emp-empty">Không có hồ sơ phù hợp bộ lọc.</p>}
          {error && (
            <p className="emp-error" role="alert">
              {error}
            </p>
          )}

          <Pager page={page} perPage={PER_PAGE} total={list?.total ?? 0} shown={items.length} noun="hồ sơ" onPage={setPage} />
        </div>

        {selectedId ? (
          <ApplicantPanel key={selectedId} id={selectedId} onPatch={patchItem} onChanged={onChanged} />
        ) : (
          <aside className="emp-card appl-panel appl-panel--empty">Chọn một hồ sơ để xem chi tiết.</aside>
        )}
      </div>
    </div>
  );
}

/* ---------- Dòng hồ sơ ---------- */
function ApplicantRow({ a, selected, onSelect }: { a: EmployerApplicantItem; selected: boolean; onSelect: () => void }) {
  const waitedHours = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 3600_000);
  return (
    <div className={cx('appl-grid appl-row', selected && 'appl-row--selected')} role="row" onClick={onSelect}>
      <span className="appl-row__person">
        <ApplicantAvatar name={a.fullName} />
        <span className="appl-row__text">
          <span className="appl-row__name">
            <button type="button" className="appl-row__name-btn" onClick={onSelect} aria-pressed={selected}>
              {a.fullName}
            </button>
            {a.unseen && <span className="appl-row__unseen" aria-label="Chưa xem" title="Chưa xem" />}
          </span>
          <span className="appl-row__meta">
            {GENDER_SHORT[a.gender]} · {a.age}t{a.hometown ? ` · ${a.hometown}` : ''}
          </span>
        </span>
      </span>
      <span className="appl-row__job">
        <span className="appl-row__job-title">{a.job.shortTitle}</span>
        {a.tags.length > 0 && (
          <span className="appl-row__tags">
            {a.tags.slice(0, 3).map((t) => (
              <span key={t} className="appl-tag">
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
      <span>
        <MatchBadge score={a.matchScore} />
      </span>
      <span>
        <StagePill stage={a.stage} />
      </span>
      <span className={cx('appl-row__time', a.overdue && 'appl-row__time--late')}>{a.overdue ? `Chờ ${waitedHours} giờ` : timeAgo(a.createdAt)}</span>
    </div>
  );
}

function StagePill({ stage }: { stage: ApplicantStage }) {
  return (
    <span className="appl-pill">
      <span className={cx('appl-stage__dot', `appl-stage__dot--${stage}`)} />
      {APPLICANT_STAGE_LABEL[stage]}
    </span>
  );
}

/* ---------- Bảng chi tiết hồ sơ ---------- */
function ApplicantPanel({ id, onPatch, onChanged }: { id: string; onPatch: (id: string, patch: Partial<EmployerApplicantItem>) => void; onChanged: () => Promise<void> }) {
  const [d, setD] = useState<EmployerApplicantDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<EmployerApplicantDetail>(`/employer/applications/${encodeURIComponent(id)}`)
      .then((detail) => {
        if (!active) return;
        setD(detail);
        // Mở xem lần đầu → bỏ đánh dấu "chưa xem"
        if (detail.unseen) {
          void apiRequest<void>(`/employer/applications/${encodeURIComponent(id)}/seen`, { method: 'POST' }).then(() => onPatch(id, { unseen: false }));
        }
      })
      .catch((e: unknown) => active && setError(apiMessage(e, 'Không tải được hồ sơ.')));
    return () => {
      active = false;
    };
  }, [id, onPatch]);

  const setStatus = async (status: ApplicationStatus) => {
    if (!d) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>(`/employer/applications/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const detail = await apiRequest<EmployerApplicantDetail>(`/employer/applications/${encodeURIComponent(id)}`);
      setD(detail);
      onPatch(id, { status: detail.status, stage: detail.stage, overdue: false, unseen: false });
      await onChanged();
    } catch (e) {
      setError(apiMessage(e, 'Không cập nhật được bước tuyển dụng.'));
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!note.trim()) {
      setNoteError('Vui lòng nhập ghi chú');
      return;
    }
    try {
      const created = await apiRequest<ApplicantNoteItem>(`/employer/applications/${encodeURIComponent(id)}/notes`, { method: 'POST', body: JSON.stringify({ body: note }) });
      setD((x) => (x ? { ...x, notes: [created, ...x.notes] } : x));
      setNote('');
    } catch (e) {
      setNoteError(apiMessage(e, 'Không lưu được ghi chú.'));
    }
  };

  if (!d) return <aside className="emp-card appl-panel appl-panel--empty">{error || 'Đang tải hồ sơ…'}</aside>;

  const scheduleHref = `${EMPLOYER_BASE}/lich-phong-van/tao?app=${d.id}`;
  const facts: Array<[string, string]> = [
    ['Số điện thoại', maskPhone(d.phone)],
    ['Chiều cao · Cân nặng', d.heightCm || d.weightKg ? `${d.heightCm ?? '—'} cm · ${d.weightKg ?? '—'} kg` : 'Chưa cập nhật'],
    ['Học vấn', d.education ? (EDUCATION_LABEL[d.education as EducationLevel] ?? d.education) : 'Chưa cập nhật'],
    ['Kinh nghiệm', d.experience ?? 'Chưa cập nhật'],
    ['Hộ chiếu', d.passport ? (PASSPORT_LABEL[d.passport as PassportStatus] ?? d.passport) : 'Chưa cập nhật'],
    ['Có thể xuất cảnh', d.departWithin ? (DEPART_WITHIN_LABEL[d.departWithin] ?? d.departWithin) : 'Chưa cập nhật'],
  ];
  const timeline = [
    ...d.events.map((e) => ({ key: `${e.status}-${e.createdAt}`, title: e.note ?? APPLICATION_STATUS_LABEL[e.status], time: timeAgo(e.createdAt), current: false })),
    { key: 'source', title: d.source === 'hotline' || d.source === 'referral' || d.source === 'job_fair' || d.source === 'social' || d.source === 'other' ? `NTD thêm thủ công · ${APPLICATION_SOURCE_LABEL[d.source]}` : `Ứng tuyển qua viecpro.vn · ${APPLICATION_SOURCE_LABEL[d.source]}`, time: timeAgo(d.createdAt), current: false },
  ];
  if (d.matchScore !== null) timeline.unshift({ key: 'match', title: `Hệ thống chấm ${d.matchScore}% phù hợp`, time: 'Tự động', current: true });
  const primary =
    d.stage === 'new'
      ? { label: 'Đánh dấu đã liên hệ', status: 'viewed' as const }
      : d.stage === 'interview'
        ? { label: 'Đánh dấu trúng tuyển', status: 'passed' as const }
        : d.status === 'passed'
          ? { label: 'Đánh dấu đã xuất cảnh', status: 'departed' as const }
          : null;

  return (
    <aside className="emp-card appl-panel" aria-label={`Hồ sơ ${d.fullName}`}>
      <div className="appl-panel__head">
        <ApplicantAvatar name={d.fullName} size="lg" />
        <span className="appl-panel__who">
          <span className="appl-panel__name">{d.fullName}</span>
          <span className="appl-panel__meta">
            {GENDER_SHORT[d.gender]} · {d.age}t{d.hometown ? ` · ${d.hometown}` : ''}
            {d.maritalStatus ? ` · ${MARITAL_LABEL[d.maritalStatus as MaritalStatus] ?? d.maritalStatus}` : ''}
          </span>
          {d.matchScore !== null && <span className={cx('emp-match appl-panel__match', d.matchScore >= 90 && 'emp-match--high')}>{d.matchScore}% phù hợp với đơn</span>}
        </span>
      </div>
      <div className="appl-panel__contact">
        <a className="emp-btn appl-panel__btn" href={telHref(d.phone)}>
          <IconPhone size={14} />
          Gọi điện
        </a>
        <a className="emp-btn appl-panel__btn" href={zaloHref(d.phone)} target="_blank" rel="noreferrer">
          <IconChatSquare size={14} />
          Zalo
        </a>
        <Link className="emp-btn appl-panel__btn" href={scheduleHref}>
          <IconCalendar size={14} />
          Hẹn lịch
        </Link>
      </div>

      <div className="appl-panel__body">
        <div className="appl-section">
          <span className="appl-section__head">
            <b>Bước tuyển dụng</b>
            <span>{d.job.shortTitle}</span>
          </span>
          <div className="appl-steps" role="radiogroup" aria-label="Bước tuyển dụng">
            {APPLICANT_STAGES.map((s) => {
              const target = STEP_STATUS[s];
              const active = d.stage === s;
              // Phỏng vấn cần tạo lịch hẹn → chuyển sang trang tạo lịch
              if (s === 'interview' && !active && !d.interviewAt) {
                return (
                  <Link key={s} href={scheduleHref} role="radio" aria-checked={false} className="appl-steps__btn">
                    {STEP_LABEL[s]}
                  </Link>
                );
              }
              return (
                <button key={s} type="button" role="radio" aria-checked={active} className={cx('appl-steps__btn', active && 'appl-steps__btn--active', s === 'rejected' && active && 'appl-steps__btn--rejected')} disabled={busy || active || !target || d.status === 'withdrawn'} onClick={() => target && void setStatus(target)}>
                  {STEP_LABEL[s]}
                </button>
              );
            })}
          </div>
          {d.status === 'withdrawn' && <span className="appl-section__warn">Ứng viên đã rút hồ sơ.</span>}
        </div>

        <div className="appl-why">
          <b>Vì sao phù hợp</b>
          {d.matchReasons.map((r) => (
            <span key={r.text} className={cx('appl-why__item', !r.ok && 'appl-why__item--warn')}>
              {r.ok ? <IconCheck size={14} className="icon--w26" /> : <IconExclaim size={14} className="icon--w26" />}
              {r.text}
            </span>
          ))}
        </div>

        <dl className="appl-facts">
          {facts.map(([k, v]) => (
            <div key={k} className="appl-facts__item">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        {d.documents.length > 0 && (
          <div className="appl-section">
            <b>Giấy tờ đính kèm</b>
            {d.documents.map((doc) => (
              <a
                key={doc.name}
                className="emp-doc"
                href={doc.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!doc.url}
                aria-label={doc.url ? `Tải ${doc.name}` : `${doc.name} (chưa tải tệp lên)`}
              >
                <span className={cx('emp-doc__type', doc.kind === 'image' && 'emp-doc__type--image')}>{doc.kind === 'pdf' ? 'PDF' : 'JPG'}</span>
                <span className="emp-doc__text">
                  <span className="emp-doc__name">{doc.name}</span>
                  <span className="emp-doc__size">{doc.kind === 'pdf' ? 'PDF' : 'Ảnh'} · {doc.sizeKb >= 1000 ? `${decimal(doc.sizeKb / 1024)} MB` : `${doc.sizeKb} KB`}</span>
                </span>
                <IconDownload size={15} />
              </a>
            ))}
          </div>
        )}

        {d.interviewAt && (
          <p className="appl-interview">
            <IconCalendar size={14} />
            Lịch phỏng vấn: {hourMinute(d.interviewAt)} {dayMonth(d.interviewAt, true)}
          </p>
        )}

        <div className="appl-section">
          <b>Hoạt động</b>
          <ol className="appl-timeline">
            {timeline.map((t) => (
              <li key={t.key} className={cx('appl-timeline__item', t.current && 'appl-timeline__item--current')}>
                <span className="appl-timeline__dot" />
                <span className="appl-timeline__text">
                  <span>{t.title}</span>
                  <small>{t.time}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {d.partnerViews?.length ? (
          <div className="appl-section appl-partner-views">
            <b>Công ty phái cử đã xem</b>
            {d.partnerViews.map((view) => (
              <span key={`${view.employerName}-${view.viewedAt}`} className="appl-partner-views__item">
                <span>{view.employerName} đã xem hồ sơ này</span>
                <small>{timeAgo(view.viewedAt)}</small>
              </span>
            ))}
          </div>
        ) : null}

        <div className="appl-section">
          <b>Ghi chú nội bộ</b>
          {d.notes.map((n) => (
            <span key={n.id} className="appl-note">
              <span className="appl-note__body">{n.body}</span>
              <small>
                {n.author?.name ?? 'Cán bộ'} · {timeAgo(n.createdAt)}
              </small>
            </span>
          ))}
          <textarea
            className={cx('appl-note__input', noteError && 'appl-note__input--invalid')}
            value={note}
            maxLength={1000}
            placeholder="Thêm ghi chú cho đồng nghiệp… (Ctrl + Enter để lưu)"
            aria-label="Ghi chú nội bộ"
            aria-invalid={!!noteError}
            aria-describedby={noteError ? 'appl-note-error' : undefined}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveNote();
            }}
          />
          {noteError && (
            <span id="appl-note-error" className="appl-section__warn">
              {noteError}
            </span>
          )}
          {note.trim() && (
            <button type="button" className="emp-btn emp-btn--md appl-note__save" onClick={() => void saveNote()}>
              Lưu ghi chú
            </button>
          )}
        </div>

        {error && (
          <p className="emp-error" role="alert">
            {error}
          </p>
        )}
        <div className="appl-panel__actions">
          <button type="button" className="emp-btn emp-btn--danger appl-panel__reject" disabled={busy || d.stage === 'rejected'} onClick={() => void setStatus('rejected')}>
            Không phù hợp
          </button>
          {d.stage === 'contacted' ? (
            <Link href={scheduleHref} className="emp-btn emp-btn--primary appl-panel__primary">
              Hẹn phỏng vấn
            </Link>
          ) : (
            <button type="button" className="emp-btn emp-btn--primary appl-panel__primary" disabled={busy || !primary} onClick={() => primary && void setStatus(primary.status)}>
              {primary?.label ?? (d.stage === 'rejected' ? 'Đã loại hồ sơ' : 'Đã hoàn tất')}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}


/** Xuất CSV danh sách theo bộ lọc hiện tại (tối đa 1.000 hồ sơ) */
async function exportCsv(filters: URLSearchParams) {
  const rows: EmployerApplicantItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const p = new URLSearchParams(filters);
    p.set('page', String(page));
    p.set('limit', '50');
    const data = await apiRequest<EmployerApplicantList>(`/employer/applications?${p.toString()}`);
    rows.push(...data.items);
    if (!data.hasMore) break;
  }
  const head = ['Họ tên', 'Giới tính', 'Tuổi', 'Quê quán', 'Số điện thoại', 'Đơn ứng tuyển', 'Phù hợp (%)', 'Bước', 'Ngày ứng tuyển'];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((a) => [a.fullName, GENDER_SHORT[a.gender], a.age, a.hometown ?? '', a.phone.replace(/^\+84/, '0'), a.job.shortTitle, a.matchScore ?? '', APPLICANT_STAGE_LABEL[a.stage], dayMonth(a.createdAt, true)].map(esc).join(','));
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ung-vien.csv';
  link.click();
  URL.revokeObjectURL(url);
}
