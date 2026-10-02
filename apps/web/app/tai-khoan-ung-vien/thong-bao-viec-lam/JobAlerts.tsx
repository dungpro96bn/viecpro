'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ALERT_CHANNEL_LABEL,
  ALERT_FREQUENCY_LABEL,
  WEB_LINKS,
  type AlertFeedItem,
  type JobAlertInput,
  type JobAlertItem,
  type JobAlertList,
  type JobAlertSuggestion,
  type JobListItem,
  type Paginated,
} from '@viecpro/shared';
import Switch from '@/components/ui/Switch';
import { IconBell, IconBriefcaseLine, IconChevronDown, IconClock, IconPlus, IconTarget } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { cx, formatYen } from '@/lib/format';
import AlertEditor, { EMPTY_CRITERIA, type AlertDraft } from './AlertEditor';

/** Số chip hiện trên thẻ, phần còn lại gộp "+n" */
const VISIBLE_CHIPS = 3;
/** Màu ô icon xoay vòng theo thứ tự thẻ (bảng màu dataviz của design) */
const TONES = ['blue', 'orange', 'teal', 'violet'] as const;
/** Việc đăng trong 3 ngày có chấm đỏ "mới" */
const FRESH_MS = 3 * 86400_000;

const toDraft = (a: JobAlertItem): AlertDraft => ({ name: a.name, criteria: a.criteria, channels: a.channels, frequency: a.frequency });
const NEW_DRAFT: AlertDraft = { name: '', criteria: EMPTY_CRITERIA, channels: ['app', 'email'], frequency: 'daily' };

/** Thông báo việc làm (design-new 04 – C-05) */
export default function JobAlerts() {
  const [data, setData] = useState<JobAlertList | null>(null);
  const [feed, setFeed] = useState<AlertFeedItem[]>([]);
  const [suggestions, setSuggestions] = useState<JobAlertSuggestion[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [list, f, s] = await Promise.all([
        apiRequest<JobAlertList>('/me/alerts'),
        apiRequest<AlertFeedItem[]>('/me/alerts/feed').catch(() => []),
        apiRequest<JobAlertSuggestion[]>('/me/alerts/suggestions').catch(() => []),
      ]);
      setData(list);
      setFeed(f);
      setSuggestions(s);
      setError('');
    } catch {
      setError('Không tải được thông báo việc làm. Vui lòng tải lại trang.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setFieldErrors({});
    setNotice('');
    setError('');
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) setFieldErrors(e.fields);
      setError(apiMessage(e, 'Không lưu được. Vui lòng thử lại.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (input: JobAlertInput) => {
    if (await run(() => apiRequest<void>('/me/alerts', { method: 'POST', body: JSON.stringify(input) }), 'Đã tạo thông báo việc làm.')) setCreating(false);
  };
  const update = async (id: string, input: JobAlertInput) => {
    if (await run(() => apiRequest<void>(`/me/alerts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }), 'Đã lưu thay đổi.')) setOpenId(null);
  };
  const remove = async (a: JobAlertItem) => {
    if (!window.confirm(`Xoá thông báo “${a.name}”?`)) return;
    if (await run(() => apiRequest<void>(`/me/alerts/${encodeURIComponent(a.id)}`, { method: 'DELETE' }), 'Đã xoá thông báo.')) setOpenId(null);
  };
  const toggle = async (a: JobAlertItem, enabled: boolean) => {
    // Đổi ngay trên giao diện, hoàn lại nếu API lỗi
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === a.id ? { ...x, enabled } : x)) });
    try {
      await apiRequest<void>(`/me/alerts/${encodeURIComponent(a.id)}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
      void load();
    } catch (e) {
      setError(apiMessage(e, 'Không đổi được trạng thái.'));
      void load();
    }
  };
  const createFromSuggestion = (s: JobAlertSuggestion) =>
    run(() => apiRequest<void>('/me/alerts', { method: 'POST', body: JSON.stringify({ name: s.name, criteria: s.criteria, channels: ['app'], frequency: 'daily', enabled: true }) }), `Đã tạo thông báo “${s.name}”.`);

  if (!data) {
    return (
      <div className="ja" aria-busy="true">
        {error ? <p className="ja-message ja-message--error" role="alert">{error}</p> : <div className="ja-skeleton" role="status">Đang tải thông báo việc làm…</div>}
      </div>
    );
  }
  const full = data.total >= data.max;

  return (
    <div className="ja">
      <div className="ja-head">
        <span>
          <h1 className="ja-head__title">Thông báo việc làm</h1>
          <p className="ja-head__desc">
            {data.total} thông báo · {data.enabledCount} đang bật · {data.unseen} việc mới chưa xem
          </p>
        </span>
        <button type="button" className="btn btn--primary btn--md" disabled={full || creating} onClick={() => setCreating(true)} title={full ? `Tối đa ${data.max} thông báo` : undefined}>
          <IconPlus size={16} />
          Tạo thông báo
        </button>
      </div>

      {error && <p className="ja-message ja-message--error" role="alert">{error}</p>}
      {notice && <p className="ja-message" role="status">{notice}</p>}

      <div className="ja-layout">
        <div className="ja-list">
          {creating && (
            <article className="ja-card ja-card--new">
              <div className="ja-card__new-head">
                <b>Thông báo mới</b>
                <span>Chọn tiêu chí – chúng tôi gửi việc phù hợp theo tần suất bạn chọn</span>
              </div>
              <AlertEditor initial={NEW_DRAFT} submitLabel="Tạo thông báo" busy={busy} errors={fieldErrors} onSubmit={(i) => void create(i)} onCancel={() => setCreating(false)} />
            </article>
          )}

          {data.items.map((a, i) => (
            <AlertCard
              key={a.id}
              alert={a}
              tone={TONES[i % TONES.length]!}
              open={openId === a.id}
              busy={busy}
              errors={openId === a.id ? fieldErrors : {}}
              onToggleOpen={() => setOpenId((id) => (id === a.id ? null : a.id))}
              onToggle={(on) => void toggle(a, on)}
              onSave={(input) => void update(a.id, input)}
              onDelete={() => void remove(a)}
              onSeen={() => void load()}
            />
          ))}

          {!data.items.length && !creating && (
            <div className="ja-empty">
              <span className="ja-empty__icon">
                <IconBell size={26} />
              </span>
              <b>Chưa có thông báo việc làm</b>
              <p>Lưu tiêu chí tìm việc (ngành, tỉnh, lương…) để nhận ngay đơn hàng mới phù hợp qua app hoặc email.</p>
              <button type="button" className="btn btn--primary btn--md" onClick={() => setCreating(true)}>
                <IconPlus size={16} />
                Tạo thông báo đầu tiên
              </button>
            </div>
          )}
        </div>

        <aside className="ja-aside" aria-label="Gợi ý">
          <section className="ja-feed">
            <span className="ja-feed__head">
              <b>Việc mới cho bạn</b>
              <Link href={WEB_LINKS.search}>Xem tất cả</Link>
            </span>
            {feed.length ? (
              feed.slice(0, 6).map((j) => (
                <Link key={j.id} className="ja-feed__item" href={WEB_LINKS.job(j.slug)}>
                  <span className="ja-feed__thumb">
                    <img src={j.imageUrl} alt="" />
                    {j.publishedAt && Date.now() - new Date(j.publishedAt).getTime() < FRESH_MS && <i aria-label="Mới" />}
                  </span>
                  <span className="ja-feed__info">
                    <span className="ja-feed__title">{j.title}</span>
                    <span className="ja-feed__meta">
                      {formatYen(j.salary)} · <b>{j.matchScore}%</b>
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="ja-feed__empty">Bật một thông báo để xem việc mới khớp tiêu chí ở đây.</p>
            )}
          </section>

          {suggestions.map((s) => (
            <section key={s.name} className="ja-suggest">
              <span className="ja-suggest__eyebrow">
                <IconTarget size={14} />
                GỢI Ý TỪ HỒ SƠ CỦA BẠN
              </span>
              <b className="ja-suggest__name">{s.name}</b>
              <span className="ja-suggest__desc">
                {s.weeklyCount} việc phù hợp mới trong tuần – {s.reason.charAt(0).toLowerCase() + s.reason.slice(1)}.
              </span>
              <button type="button" className="ja-suggest__btn" disabled={busy || full} onClick={() => void createFromSuggestion(s)}>
                <IconPlus size={15} />
                Tạo thông báo này
              </button>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}

interface CardProps {
  alert: JobAlertItem;
  tone: (typeof TONES)[number];
  open: boolean;
  busy: boolean;
  errors: Record<string, string>;
  onToggleOpen: () => void;
  onToggle: (on: boolean) => void;
  onSave: (input: JobAlertInput) => void;
  onDelete: () => void;
  onSeen: () => void;
}

/** Một thẻ thông báo: tiêu đề + số việc mới, chip tiêu chí, tần suất, công tắc; mở rộng để xem việc và sửa */
function AlertCard({ alert: a, tone, open, busy, errors, onToggleOpen, onToggle, onSave, onDelete, onSeen }: CardProps) {
  const [jobs, setJobs] = useState<Paginated<JobListItem> | null>(null);
  const extra = a.chips.length - VISIBLE_CHIPS;

  useEffect(() => {
    if (!open) return;
    // Mở chi tiết = đã xem việc mới (API đánh dấu lastSeenAt)
    let alive = true;
    apiRequest<Paginated<JobListItem>>(`/me/alerts/${encodeURIComponent(a.id)}/jobs?page=1&limit=5`)
      .then((r) => {
        if (!alive) return;
        setJobs(r);
        if (a.newCount) onSeen();
      })
      .catch(() => alive && setJobs(null));
    return () => {
      alive = false;
    };
    // Chỉ tải lại khi mở thẻ / đổi thẻ – không theo newCount / onSeen (tránh tải vòng)
  }, [open, a.id]);

  return (
    <article className={cx('ja-card', !a.enabled && 'ja-card--off')}>
      <div className="ja-card__main">
        <span className={cx('ja-card__icon', `ja-card__icon--${tone}`)}>
          <IconBriefcaseLine size={20} />
        </span>
        <span className="ja-card__body">
          <span className="ja-card__title">
            <b>{a.name}</b>
            <span className={cx('ja-count', a.newCount > 0 && 'ja-count--new')}>{a.newCount > 0 ? `${a.newCount} việc mới` : 'Chưa có việc mới'}</span>
          </span>
          <span className="ja-card__chips">
            {a.chips.slice(0, VISIBLE_CHIPS).map((c) => (
              <span key={c} className="ja-tag">
                {c}
              </span>
            ))}
            {extra > 0 && (
              <span className="ja-tag ja-tag--more" title={a.chips.slice(VISIBLE_CHIPS).join(', ')}>
                +{extra}
              </span>
            )}
          </span>
          <span className="ja-card__freq">
            <IconClock size={14} />
            {ALERT_FREQUENCY_LABEL[a.frequency]} · {a.channels.map((c) => ALERT_CHANNEL_LABEL[c]).join(', ')}
          </span>
        </span>
        <Switch on={a.enabled} onChange={onToggle} label={`${a.enabled ? 'Tắt' : 'Bật'} thông báo ${a.name}`} />
      </div>

      {open && (
        <div className="ja-card__detail">
          <div className="ja-card__jobs">
            <span className="ja-card__jobs-head">
              <b>Việc khớp tiêu chí</b>
              {jobs && <small>{jobs.total} việc đang tuyển</small>}
            </span>
            {jobs ? (
              jobs.items.length ? (
                <ul>
                  {jobs.items.map((j) => (
                    <li key={j.id}>
                      <Link href={WEB_LINKS.job(j.slug)}>
                        <img src={j.imageUrl} alt="" />
                        <span>
                          <b>{j.title}</b>
                          <small>
                            {j.pref} · {formatYen(j.salary)}
                          </small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ja-card__jobs-empty">Chưa có việc khớp – thử bỏ bớt tiêu chí.</p>
              )
            ) : (
              <p className="ja-card__jobs-empty">Đang tải…</p>
            )}
          </div>
          <AlertEditor initial={toDraft(a)} submitLabel="Lưu thay đổi" busy={busy} errors={errors} onSubmit={onSave} onCancel={onToggleOpen} onDelete={onDelete} />
        </div>
      )}

      <button type="button" className={cx('ja-card__more', open && 'ja-card__more--open')} aria-expanded={open} onClick={onToggleOpen}>
        {open ? 'Thu gọn' : 'Xem chi tiết & cài đặt'}
        <IconChevronDown size={15} />
      </button>
    </article>
  );
}
