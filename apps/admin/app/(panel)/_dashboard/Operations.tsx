'use client';

import type { ActivityItem, AdminDashboard, ModerationItem, VerificationItem } from '@viecpro/shared';
import Link from 'next/link';
import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import { IconBell, IconBriefcase, IconCheck, IconFlag, IconModeration, IconSend, IconShieldCheck } from '@/components/ui/Icons';
import { ApiRequestError, post } from '@/lib/api';
import { cx, formatNumber, formatSla, initials, timeAgo } from '@/lib/format';

const errorText = (e: unknown) => (e instanceof ApiRequestError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại');

/* ---------------- Hàng chờ kiểm duyệt ---------------- */
const riskLevel = (risk: number) => (risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low');

export function ModerationQueue({ queue, canModerate, onChanged }: { queue: AdminDashboard['moderationQueue']; canModerate: boolean; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ModerationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = async (item: ModerationItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      await post(`/admin/jobs/${item.id}/approve`);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (reason: string) => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setError(null);
    try {
      await post(`/admin/jobs/${rejecting.id}/reject`, { reason });
      setRejecting(null);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel panel--flush">
      <div className="queue__head">
        <span className="panel__titles">
          <h2 className="panel__title">Hàng chờ kiểm duyệt</h2>
          <span className="panel__subtitle">Chấm điểm rủi ro tự động · sắp xếp theo hạn SLA 2 giờ</span>
        </span>
        <span className="queue__tools">
          <span className="queue__count">
            {queue.items.length} trong {formatNumber(queue.total)} tin
          </span>
          <Link href="/kiem-duyet-tin" className="btn btn--outline btn--sm">
            Mở hàng chờ
          </Link>
        </span>
      </div>

      {error && !rejecting && (
        <p className="alert alert--danger queue__error" role="alert">
          {error}
        </p>
      )}

      {queue.items.length === 0 ? (
        <p className="empty queue__empty">Không còn tin nào chờ duyệt.</p>
      ) : (
        <div className="queue" role="table" aria-label="Tin chờ duyệt">
          <div className="queue__row queue__row--header" role="row">
            <span role="columnheader">Tin tuyển dụng</span>
            <span role="columnheader">Điểm rủi ro</span>
            <span role="columnheader">SLA</span>
            <span role="columnheader" className="queue__right">
              Thao tác
            </span>
          </div>
          {queue.items.map((item) => {
            const level = riskLevel(item.risk);
            return (
              <div key={item.id} role="row" className={cx('queue__row', level === 'high' && 'queue__row--high', busyId === item.id && 'queue__row--busy')}>
                <span className="queue__job" role="cell">
                  <img className="queue__img" src={item.imageUrl} alt="" width={46} height={46} />
                  <span className="queue__job-text">
                    <span className="queue__title">{item.title}</span>
                    <span className="queue__meta">
                      <span>{item.employerName}</span>
                      {item.flag && <span className={cx('tag', item.flag === 'Bị báo cáo' ? 'tag--danger' : 'tag--gray')}>{item.flag}</span>}
                    </span>
                  </span>
                </span>
                <span className="risk" role="cell">
                  <span className={cx('risk__score', `risk__score--${level}`)}>{item.risk} / 100</span>
                  <span className="risk__track">
                    <span className={cx('risk__bar', `risk__bar--${level}`)} style={{ width: `${item.risk}%` }} />
                  </span>
                </span>
                <span className={cx('queue__sla', item.slaMinutes < 20 && 'queue__sla--urgent')} role="cell">
                  {formatSla(item.slaMinutes)}
                </span>
                <span className="queue__actions" role="cell">
                  {canModerate ? (
                    <>
                      <button type="button" className="btn btn--danger-outline btn--sm" disabled={!!busyId} onClick={() => setRejecting(item)}>
                        Từ chối
                      </button>
                      <button type="button" className="btn btn--success btn--sm" disabled={!!busyId} onClick={() => void approve(item)}>
                        {busyId === item.id ? <span className="spinner" /> : <IconCheck size={13} className="icon--w28" />}
                        Duyệt
                      </button>
                    </>
                  ) : (
                    <span className="queue__readonly">Chỉ xem</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!rejecting}
        title="Từ chối tin tuyển dụng"
        description={rejecting ? `“${rejecting.title}” – lý do sẽ được gửi cho nhà tuyển dụng.` : undefined}
        input={{ label: 'Lý do từ chối', placeholder: 'VD: Thu thêm phí giữ chỗ không có trong hợp đồng…', required: true, minLength: 5 }}
        confirmLabel="Từ chối tin"
        tone="danger"
        busy={!!busyId}
        error={rejecting ? error : null}
        onConfirm={(reason) => void reject(reason)}
        onClose={() => {
          setRejecting(null);
          setError(null);
        }}
      />
    </section>
  );
}

/* ---------------- Hoạt động trực tiếp ---------------- */
const ACTIVITY_ICON = {
  job: { icon: IconBriefcase, tone: 'primary' },
  application: { icon: IconSend, tone: 'success' },
  moderation: { icon: IconModeration, tone: 'danger' },
  verification: { icon: IconShieldCheck, tone: 'warning' },
  subscription: { icon: IconBell, tone: 'violet' },
  admin: { icon: IconShieldCheck, tone: 'gray' },
} as const;

export function LiveActivity({ items }: { items: ActivityItem[] }) {
  return (
    <section className="panel activity">
      <div className="activity__head">
        <h2 className="panel__title">Hoạt động trực tiếp</h2>
        <span className="activity__live">
          <span className="activity__live-dot" />
          LIVE
        </span>
      </div>
      {items.length === 0 ? (
        <p className="empty">Chưa có hoạt động.</p>
      ) : (
        <ul className="activity__list">
          {items.map((a, i) => {
            const { icon: Icon, tone } = ACTIVITY_ICON[a.type];
            return (
              <li key={`${a.at}-${i}`} className="activity__item">
                <span className={`activity__icon activity__icon--${tone}`}>
                  <Icon size={14} className="icon--w2" />
                </span>
                <span className="activity__text">
                  <b>{a.actor}</b> {a.text}
                </span>
                <time className="activity__time" dateTime={a.at}>
                  {timeAgo(a.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Xác minh doanh nghiệp ---------------- */
export function VerificationList({ data, canVerify, onChanged }: { data: AdminDashboard['verifications']; canVerify: boolean; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asking, setAsking] = useState<VerificationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (item: VerificationItem, path: 'approve' | 'request-info', note?: string) => {
    setBusyId(item.id);
    setError(null);
    try {
      await post(`/admin/verifications/${item.id}/${path}`, note ? { note } : {});
      setAsking(null);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel verify">
      <div className="panel__head">
        <h2 className="panel__title">Xác minh doanh nghiệp</h2>
        <span className="panel__meta">{formatNumber(data.total)} hồ sơ chờ</span>
      </div>
      {error && !asking && (
        <p className="alert alert--danger" role="alert">
          {error}
        </p>
      )}
      {data.items.length === 0 ? (
        <p className="empty">Không có hồ sơ chờ xác minh.</p>
      ) : (
        data.items.map((v, i) => {
          const complete = v.documents.every((d) => d.ok);
          return (
            <article key={v.id} className="verify__item">
              <span className={`verify__avatar verify__avatar--c${(i % 4) + 1}`}>{initials(v.name.replace(/\(.*\)/, ''))}</span>
              <span className="verify__body">
                <b className="verify__name">{v.name}</b>
                <span className="verify__sub">{v.subtitle}</span>
                <span className="verify__docs">
                  {v.documents.map((d) => (
                    <span key={d.label} className={cx('tag', d.ok ? 'tag--success' : 'tag--warning')}>
                      {d.ok ? '✓' : '!'} {d.label}
                    </span>
                  ))}
                  {v.status === 'needs_info' && <span className="tag tag--gray">Đã yêu cầu bổ sung</span>}
                </span>
              </span>
              {canVerify &&
                (complete ? (
                  <button type="button" className="btn btn--primary btn--sm" disabled={!!busyId} onClick={() => void act(v, 'approve')}>
                    {busyId === v.id ? <span className="spinner" /> : 'Xác minh'}
                  </button>
                ) : (
                  <button type="button" className="btn btn--warning-outline btn--sm" disabled={!!busyId || v.status === 'needs_info'} onClick={() => setAsking(v)}>
                    Yêu cầu bổ sung
                  </button>
                ))}
            </article>
          );
        })
      )}
      <Dialog
        open={!!asking}
        title="Yêu cầu bổ sung giấy tờ"
        description={asking ? `Gửi thông báo cho ${asking.name}.` : undefined}
        input={{
          label: 'Nội dung yêu cầu',
          defaultValue: asking ? `Vui lòng bổ sung: ${asking.documents.filter((d) => !d.ok).map((d) => d.label).join(', ')}.` : '',
          required: true,
          minLength: 5,
        }}
        confirmLabel="Gửi yêu cầu"
        tone="warning"
        busy={!!busyId}
        error={asking ? error : null}
        onConfirm={(note) => asking && void act(asking, 'request-info', note)}
        onClose={() => {
          setAsking(null);
          setError(null);
        }}
      />
    </section>
  );
}

/* ---------------- Báo cáo vi phạm ---------------- */
export function ReportList({ reports }: { reports: AdminDashboard['reports'] }) {
  return (
    <section className="panel reports">
      <div className="panel__head">
        <h2 className="panel__title">Báo cáo vi phạm mới</h2>
        {reports.open > 0 && <span className="reports__badge">{reports.open} chưa xử lý</span>}
      </div>
      {reports.groups.length === 0 ? (
        <p className="empty">Không có báo cáo vi phạm.</p>
      ) : (
        <ul className="reports__list">
          {reports.groups.map((g) => (
            <li key={`${g.reason}-${g.target}`} className="reports__item">
              <span className={cx('reports__icon', `reports__icon--${g.severity}`)}>
                <IconFlag size={15} className="icon--w2" />
              </span>
              <span className="reports__body">
                <b className="reports__reason">{g.reason}</b>
                <span className="reports__target">
                  {g.target} · {g.reporters} người báo cáo
                </span>
              </span>
              <time className="reports__time" dateTime={g.latestAt}>
                {timeAgo(g.latestAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Nhu cầu theo tỉnh ---------------- */
export function DemandByPref({ items }: { items: AdminDashboard['demandByPref'] }) {
  const max = Math.max(1, ...items.map((i) => i.quota));
  return (
    <section className="panel">
      <span className="panel__titles">
        <h2 className="panel__title">Nhu cầu tuyển theo tỉnh Nhật</h2>
        <span className="panel__subtitle">Chỉ tiêu đang mở · top {items.length}</span>
      </span>
      {items.length === 0 ? (
        <p className="empty">Chưa có đơn đang tuyển.</p>
      ) : (
        <ul className="demand">
          {items.map((i) => (
            <li key={i.pref} className="demand__row">
              <span className="demand__pref">{i.pref}</span>
              <span className="demand__track">
                <span className="demand__bar" style={{ width: `${(i.quota / max) * 100}%` }} />
              </span>
              <b className="demand__value">{formatNumber(i.quota)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
