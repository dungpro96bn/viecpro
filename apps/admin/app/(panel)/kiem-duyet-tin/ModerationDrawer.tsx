'use client';

import { useEffect, useState } from 'react';
import { JOB_GENDER_LABEL, JOB_STATUS_LABEL, PROGRAM_LABEL, REPORT_STATUS_LABEL, type ModerationDetail, type ModerationItem } from '@viecpro/shared';
import Drawer from '@/components/list/Drawer';
import { dateTime, errorText } from '@/components/list/list-utils';
import { IconAlert, IconCheck, IconClose, IconExternal, IconScanCheck } from '@/components/ui/Icons';
import { api, WEB_URL } from '@/lib/api';
import { cx, formatNumber, formatSla } from '@/lib/format';
import type { Decision } from './DecisionDialog';
import { riskLevel } from './moderation-utils';

/** Tên thao tác trong lịch sử tin */
const EVENT_LABEL: Record<string, string> = {
  create: 'Tạo tin',
  submit: 'Gửi duyệt',
  update: 'Cập nhật',
  draft: 'Lưu nháp',
  approve: 'Đã duyệt',
  reject: 'Từ chối',
  request_changes: 'Yêu cầu sửa',
  pause: 'Tạm ẩn',
  resume: 'Hiển thị lại',
  close: 'Đóng tin',
  boost: 'Đẩy tin',
  auto_hide: 'Tự tạm ẩn',
  restore: 'Hiển thị lại',
  remove: 'Gỡ tin',
};
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');

interface Props {
  id: string | null;
  canModerate: boolean;
  onClose: () => void;
  onApprove: (item: ModerationItem) => void;
  onDecide: (item: ModerationItem, kind: Decision) => void;
}

/** Chi tiết tin cần kiểm duyệt: thông số chính, kiểm tra tự động, nội dung, báo cáo, lịch sử */
export default function ModerationDrawer({ id, canModerate, onClose, onApprove, onDecide }: Props) {
  const [d, setD] = useState<ModerationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    setError(null);
    if (!id) return;
    api<ModerationDetail>(`/admin/jobs/${id}`)
      .then(setD)
      .catch((e: unknown) => setError(errorText(e)));
  }, [id]);

  const pending = d?.status === 'pending';
  const level = d ? riskLevel(d.risk) : 'low';
  const fails = d?.checks.filter((c) => c.status !== 'pass').length ?? 0;

  return (
    <Drawer
      open={!!id}
      title={d?.title ?? 'Chi tiết tin'}
      subtitle={d && `${d.code} · ${d.employerName}${d.employerVerified ? ' · Đã xác minh' : ' · Chưa xác minh'}`}
      onClose={onClose}
      footer={
        d &&
        pending &&
        canModerate && (
          <>
            <button type="button" className="btn btn--danger-outline" onClick={() => onDecide(d, 'reject')}>
              <IconClose size={15} />
              Từ chối
            </button>
            <button type="button" className="btn btn--warning-outline" onClick={() => onDecide(d, 'request-changes')}>
              Yêu cầu sửa
            </button>
            <button type="button" className="btn btn--success" onClick={() => onApprove(d)}>
              <IconCheck size={15} />
              Duyệt tin
            </button>
          </>
        )
      }
    >
      {error && (
        <p className="alert alert--danger" role="alert">
          {error}
        </p>
      )}
      {!d && !error && <span className="skeleton mod-drawer-skeleton" aria-busy="true" />}
      {d && (
        <>
          <div className="mod-hero">
            <img src={d.imageUrl} alt="" />
            <span className="mod-hero__info">
              <span className={cx('mod-score mod-score--lg', `mod-score--${level}`)}>
                {d.risk}
                <small>/100</small>
              </span>
              <span className="mod-hero__flag">{d.flag ?? 'Không phát hiện vấn đề'}</span>
              {pending ? (
                <span className={cx('mod-hero__sla', d.slaMinutes <= 20 && 'mod-hero__sla--urgent')}>Hạn xử lý: {formatSla(d.slaMinutes)}</span>
              ) : (
                <span className="mod-hero__sla">
                  {d.changesRequested ? 'Đã yêu cầu sửa' : JOB_STATUS_LABEL[d.status]}
                  {d.moderatorName && ` · ${d.moderatorName}`}
                  {d.moderatedAt && ` · ${dateTime(d.moderatedAt)}`}
                </span>
              )}
              <a className="mod-hero__link" href={`${WEB_URL}/viec-lam/${d.slug}`} target="_blank" rel="noreferrer">
                Xem trang tin
                <IconExternal size={13} />
              </a>
            </span>
          </div>
          {d.rejectReason && !pending && <p className="dnote">Lý do: {d.rejectReason}</p>}

          <section className="dsec">
            <span className="dsec__title mod-checks__title">
              <IconScanCheck size={15} />
              Kiểm tra tự động · {fails ? `${fails} mục cần xem` : 'tất cả đạt'}
            </span>
            <ul className="mod-checks">
              {d.checks.map((c) => (
                <li key={c.key} className={cx('mod-check', `mod-check--${c.status}`)}>
                  <span className="mod-check__icon">{c.status === 'pass' ? <IconCheck size={13} /> : <IconAlert size={13} />}</span>
                  <span className="mod-check__text">
                    <b>{c.label}</b>
                    {c.note && <small>{c.note}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="dsec">
            <span className="dsec__title">Thông tin chính</span>
            <div className="dgrid">
              <Fact label="Chương trình" value={PROGRAM_LABEL[d.program]} />
              <Fact label="Ngành nghề" value={d.industry} />
              <Fact label="Nơi làm việc" value={`${d.pref}, Nhật Bản`} />
              <Fact label="Số lượng · giới tính" value={`${formatNumber(d.quantity)} · ${JOB_GENDER_LABEL[d.gender]}`} />
              <Fact label="Lương cơ bản" value={`${formatNumber(d.salary)} ¥/tháng${d.medianSalary ? ` (trung vị ${formatNumber(d.medianSalary)} ¥)` : ''}`} />
              <Fact label="Chi phí xuất cảnh" value={d.feeUsd === null ? 'Chưa ghi' : d.feeUsd === 0 ? 'Miễn phí' : `${formatNumber(d.feeUsd)} USD`} warn={d.feeUsd === null} />
              <Fact label="Năm sinh" value={`${d.birthYearFrom} – ${d.birthYearTo}`} />
              <Fact label="Tiếng Nhật" value={d.jlptRequired ?? 'Không yêu cầu'} />
              <Fact label="Hợp đồng" value={d.contractYears ? `${d.contractYears} năm` : '—'} />
              <Fact label="Ngày thi · hạn nhận" value={`${shortDate(d.examAt)} · ${shortDate(d.deadline)}`} />
            </div>
          </section>

          {(d.content.overview || d.content.tasks.length > 0 || d.content.requirements.length > 0 || d.content.benefits.length > 0) && (
            <section className="dsec">
              <span className="dsec__title">Nội dung tin</span>
              <div className="mod-content">
                {d.content.overview && <p>{d.content.overview}</p>}
                {d.content.tasks.length > 0 && (
                  <>
                    <b>Công việc</b>
                    <ul>
                      {d.content.tasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
                {d.content.requirements.length > 0 && (
                  <>
                    <b>Yêu cầu</b>
                    <ul>
                      {d.content.requirements.map(([k, v]) => (
                        <li key={k}>
                          {k}: {v}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {d.content.benefits.length > 0 && (
                  <>
                    <b>Quyền lợi</b>
                    <ul>
                      {d.content.benefits.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          )}

          <section className="dsec">
            <span className="dsec__title">Doanh nghiệp</span>
            <ul className="dlist">
              <li>
                <span className="dlist__text">
                  <b>{d.employer.name}</b>
                  <small>
                    {d.employer.verified ? 'Đã xác minh' : 'Chưa xác minh'} · {formatNumber(d.employer.openJobs)} tin đang hiển thị
                    {d.employer.createdAt && ` · tham gia ${shortDate(d.employer.createdAt)}`} · cán bộ: {d.recruiterName}
                  </small>
                </span>
              </li>
            </ul>
          </section>

          {d.reports.length > 0 && (
            <section className="dsec">
              <span className="dsec__title">Báo cáo vi phạm ({d.reports.length})</span>
              <ul className="dlist">
                {d.reports.map((r) => (
                  <li key={r.code}>
                    <span className="dlist__text">
                      <b>{r.reason}</b>
                      <small>
                        {r.code} · {shortDate(r.createdAt)}
                      </small>
                    </span>
                    <span className="mini-tag mini-tag--gray">{REPORT_STATUS_LABEL[r.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="dsec">
            <span className="dsec__title">Lịch sử</span>
            <ul className="mod-history">
              {d.events.length ? (
                d.events.map((e, i) => (
                  <li key={i}>
                    <b>{EVENT_LABEL[e.action] ?? e.action}</b>
                    <small>
                      {[e.actor, dateTime(e.at)].filter(Boolean).join(' · ')}
                      {e.note && ` – ${e.note}`}
                    </small>
                  </li>
                ))
              ) : (
                <li className="dlist__empty">Chưa có thao tác nào</li>
              )}
            </ul>
          </section>
        </>
      )}
    </Drawer>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span className="dgrid__item">
      <small>{label}</small>
      <b className={cx(warn && 'mod-fact--warn')}>{value}</b>
    </span>
  );
}
