'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VerificationList, VerificationListItem, VerificationTab } from '@viecpro/shared';
import Drawer from '@/components/list/Drawer';
import Pagination from '@/components/list/Pagination';
import { avatarTone, dateTime, errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import { useShell } from '@/components/layout/AdminShell';
import Dialog from '@/components/ui/Dialog';
import { IconAlert, IconArrowRight, IconCheck, IconClose, IconScanCheck, IconSearch, IconShieldCheck } from '@/components/ui/Icons';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 20;
const TABS: Array<{ key: VerificationTab; label: string }> = [
  { key: 'pending', label: 'Chờ xác minh' },
  { key: 'needs_info', label: 'Cần bổ sung' },
  { key: 'approved', label: 'Đã xác minh' },
  { key: 'rejected', label: 'Từ chối' },
];
type Kind = 'all' | 'company' | 'individual';
type Decision = 'request-info' | 'reject';

const DECISION_DIALOG: Record<Decision, { title: string; label: string; placeholder: string; confirm: string; tone: 'warning' | 'danger'; required: boolean }> = {
  'request-info': { title: 'Yêu cầu bổ sung giấy tờ', label: 'Nội dung cần bổ sung', placeholder: 'Ví dụ: Giấy phép XKLĐ đã hết hạn, vui lòng tải bản mới…', confirm: 'Gửi yêu cầu', tone: 'warning', required: false },
  reject: { title: 'Từ chối hồ sơ xác minh', label: 'Lý do từ chối', placeholder: 'Ví dụ: Mã số thuế không khớp với giấy đăng ký kinh doanh…', confirm: 'Từ chối', tone: 'danger', required: true },
};

const scoreLevel = (s: number) => (s >= 80 ? 'good' : s >= 50 ? 'mid' : 'low');

/** Xác minh doanh nghiệp / NTD cá nhân (design-new 08 – A-03) */
export default function VerificationsView() {
  const { can } = useAuth();
  const canVerify = can('employers.verify');
  const { refreshBadges } = useShell();
  const [tab, setTab] = useState<VerificationTab>('pending');
  const [kind, setKind] = useState<Kind>('all');
  const [missingDocs, setMissingDocs] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VerificationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<VerificationListItem | null>(null);
  const [deciding, setDeciding] = useState<{ item: VerificationListItem; action: Decision } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tab, page: String(page), limit: String(PAGE_SIZE) });
      if (kind !== 'all') p.set('kind', kind);
      if (missingDocs) p.set('missingDocs', 'true');
      if (q) p.set('q', q);
      setData(await api<VerificationList>(`/admin/verifications?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [tab, kind, missingDocs, q, page]);
  useEffect(() => {
    void load();
  }, [load]);
  // Từ khoá đổi → về trang 1 (các bộ lọc khác đặt lại trang ngay trong handler)
  useEffect(() => setPage(1), [q]);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const afterDecision = async (message: string) => {
    setNotice(message);
    setSelected(null);
    setDeciding(null);
    await Promise.all([load(), refreshBadges()]);
  };
  const approve = async (item: VerificationListItem) => {
    setBusy(true);
    setError(null);
    try {
      await post(`/admin/verifications/${item.id}/approve`, {});
      await afterDecision(`Đã xác minh “${item.name}”. Tin đăng mới của họ sẽ hiển thị không cần chờ duyệt.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const decide = async (note: string) => {
    if (!deciding) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/admin/verifications/${deciding.item.id}/${deciding.action}`, note ? { note } : {});
      await afterDecision(deciding.action === 'reject' ? `Đã từ chối hồ sơ “${deciding.item.name}”.` : `Đã gửi yêu cầu bổ sung cho “${deciding.item.name}”.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const open = tab === 'pending' || tab === 'needs_info';
  const s = data?.stats;

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">Bảng điều khiển / Vận hành</span>
          <h1 className="page-header__title">Xác minh doanh nghiệp</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên, mã số thuế, số điện thoại…" aria-label="Tìm hồ sơ xác minh" />
          </label>
        </div>
      </header>

      <div className="page-body">
        <div className="statline" aria-label="Tình hình xác minh">
          <span className="vf-auto">
            <IconScanCheck size={16} />
            Đối chiếu tự động: <b>Bật</b>
          </span>
          <span className="statline__item">
            <b>{s ? formatNumber(s.pending) : '—'}</b> chờ xác minh
          </span>
          <span className="statline__item statline__item--warn">
            <b>{s ? formatNumber(s.missingDocs) : '—'}</b> thiếu giấy tờ
          </span>
          <span className="statline__item statline__item--bad">
            <b>{s ? formatNumber(s.suspicious) : '—'}</b> nghi vấn
          </span>
          <span className="statline__item">
            <b>{s ? formatNumber(s.approvedThisMonth) : '—'}</b> đã xác minh tháng này
          </span>
          <span className="statline__end">Thời gian xác minh TB: {s?.avgReviewMinutes != null ? <b>{formatMinutes(s.avgReviewMinutes)}</b> : '—'}</span>
        </div>

        {error && <p className="alert alert--danger" role="alert">{error}</p>}
        {notice && (
          <p className="list-notice" role="status">
            <IconCheck size={16} />
            {notice}
            <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button>
          </p>
        )}

        <section className="list-card" aria-label="Hồ sơ xác minh">
          <div className="tabs" role="tablist" aria-label="Trạng thái hồ sơ">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx('tabs__item', tab === t.key && 'tabs__item--active')} onClick={() => filter(setTab)(t.key)}>
                {t.label}
                <span className="tabs__count">{data ? formatNumber(data.tabs[t.key]) : '…'}</span>
              </button>
            ))}
          </div>
          <div className="filters">
            {(['all', 'company', 'individual'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} className={cx('chip-toggle', kind === k && 'chip-toggle--on')} onClick={() => filter(setKind)(k)}>
                {k === 'all' ? 'Tất cả' : k === 'company' ? 'Doanh nghiệp' : 'Cá nhân'}
              </button>
            ))}
            <span className="filters__divider" />
            <button type="button" aria-pressed={missingDocs} className={cx('chip-toggle', missingDocs && 'chip-toggle--on')} onClick={() => filter(setMissingDocs)(!missingDocs)}>
              Thiếu giấy tờ
            </button>
          </div>

          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Hồ sơ đăng ký</th>
                  <th>Giấy tờ</th>
                  <th>Đối chiếu tự động</th>
                  <th>Gửi lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={5}>
                          <span className="skeleton dtable__skeleton" />
                        </td>
                      </tr>
                    ))
                  : data?.items.map((v) => (
                      <tr key={v.id}>
                        <td data-label="Hồ sơ">
                          <span className="who">
                            <span className={cx('avatar avatar--square', `avatar--${avatarTone(v.name)}`)}>{initials(v.name)}</span>
                            <span className="who__text">
                              <span className="who__name">
                                {v.name}
                                <span className={cx('mini-tag', v.kind === 'company' ? 'mini-tag--blue' : 'mini-tag--gray')}>{v.kindLabel}</span>
                              </span>
                              <span className="who__sub">{v.subtitle || '—'}</span>
                            </span>
                          </span>
                        </td>
                        <td data-label="Giấy tờ">
                          <span className="cell">
                            <span className="cell__main">
                              {v.validDocs}/{v.totalDocs} hợp lệ
                            </span>
                            <span className="vf-docs">
                              {v.documents.map((d) => (
                                <span key={d.key} className={cx('vf-doc', d.ok ? 'vf-doc--ok' : 'vf-doc--bad')}>
                                  {d.ok ? <IconCheck size={11} /> : <IconAlert size={11} />}
                                  {d.label}
                                </span>
                              ))}
                            </span>
                          </span>
                        </td>
                        <td data-label="Đối chiếu tự động">
                          <span className="cell">
                            <span className="meter">
                              <span className="meter__track">
                                <i className={cx('meter__bar', `meter__bar--${scoreLevel(v.autoScore)}`)} style={{ width: `${v.autoScore}%` }} />
                              </span>
                              <span className={cx('meter__value', `meter__value--${scoreLevel(v.autoScore)}`)}>{v.autoScore}%</span>
                            </span>
                            <span className="cell__sub">{v.autoSummary}</span>
                          </span>
                        </td>
                        <td data-label="Gửi lúc">
                          <span className="cell">
                            <span className="cell__main">{relativeTime(v.submittedAt)}</span>
                            {v.reviewedAt && <span className="cell__sub">Xử lý {relativeTime(v.reviewedAt).toLowerCase()}</span>}
                          </span>
                        </td>
                        <td data-label="Thao tác">
                          <span className="row-actions">
                            {open && canVerify && (
                              <button type="button" className="row-btn row-btn--primary" disabled={busy} onClick={() => void approve(v)}>
                                Xác minh
                              </button>
                            )}
                            <button type="button" className="row-btn" onClick={() => setSelected(v)}>
                              Xem chi tiết
                              <IconArrowRight size={13} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {data && !data.items.length && (
              <div className="list-empty">
                <IconShieldCheck size={26} />
                <b>Không có hồ sơ nào</b>
                {q || kind !== 'all' || missingDocs ? 'Thử bỏ bớt bộ lọc hoặc từ khoá tìm kiếm.' : 'Hồ sơ mới sẽ hiện ở đây khi nhà tuyển dụng gửi xác minh.'}
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="hồ sơ" onPage={setPage} />}
        </section>
      </div>

      <Drawer
        open={!!selected}
        title={selected?.name}
        subtitle={selected && `${selected.kindLabel} · ${selected.subtitle || 'Chưa có mã số'}`}
        onClose={() => setSelected(null)}
        footer={
          selected &&
          (selected.status === 'pending' || selected.status === 'needs_info') &&
          canVerify && (
            <>
              <button type="button" className="btn btn--danger-outline" disabled={busy} onClick={() => setDeciding({ item: selected, action: 'reject' })}>
                <IconClose size={15} />
                Từ chối
              </button>
              <button type="button" className="btn btn--warning-outline" disabled={busy} onClick={() => setDeciding({ item: selected, action: 'request-info' })}>
                Yêu cầu bổ sung
              </button>
              <button type="button" className="btn btn--success" disabled={busy} onClick={() => void approve(selected)}>
                <IconCheck size={15} />
                Xác minh
              </button>
            </>
          )
        }
      >
        {selected && <VerificationDetail item={selected} />}
      </Drawer>

      <Dialog
        open={!!deciding}
        title={deciding ? DECISION_DIALOG[deciding.action].title : ''}
        description={deciding ? `Nội dung sẽ được gửi tới nhà tuyển dụng “${deciding.item.name}”.` : undefined}
        input={deciding ? { label: DECISION_DIALOG[deciding.action].label, placeholder: DECISION_DIALOG[deciding.action].placeholder, required: DECISION_DIALOG[deciding.action].required, minLength: 5 } : undefined}
        confirmLabel={deciding ? DECISION_DIALOG[deciding.action].confirm : ''}
        tone={deciding ? DECISION_DIALOG[deciding.action].tone : 'primary'}
        busy={busy}
        error={deciding ? error : null}
        onConfirm={(note) => void decide(note)}
        onClose={() => setDeciding(null)}
      />
    </>
  );
}

/** 200 → "3 giờ 20 phút" */
function formatMinutes(m: number) {
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} giờ ${m % 60} phút` : `${h} giờ`;
}

const STATUS_LABEL: Record<VerificationListItem['status'], { label: string; tone: string }> = {
  pending: { label: 'Chờ xác minh', tone: 'blue' },
  needs_info: { label: 'Cần bổ sung', tone: 'orange' },
  approved: { label: 'Đã xác minh', tone: 'green' },
  rejected: { label: 'Từ chối', tone: 'red' },
};

/** Nội dung ngăn kéo: trạng thái, giấy tờ, đối chiếu tự động, checklist thủ công */
function VerificationDetail({ item }: { item: VerificationListItem }) {
  const st = STATUS_LABEL[item.status];
  const company = item.kind === 'company';
  return (
    <>
      <div className="dgrid">
        <span className="dgrid__item">
          <small>Trạng thái</small>
          <b>
            <span className={cx('status', `status--${st.tone}`)}>{st.label}</span>
          </b>
        </span>
        <span className="dgrid__item">
          <small>Gửi lúc</small>
          <b>{dateTime(item.submittedAt)}</b>
        </span>
        <span className="dgrid__item">
          <small>Đối chiếu tự động</small>
          <b>{item.autoScore}% · {item.autoSummary}</b>
        </span>
        <span className="dgrid__item">
          <small>Giấy tờ hợp lệ</small>
          <b>
            {item.validDocs}/{item.totalDocs}
          </b>
        </span>
      </div>

      {item.note && <p className="dnote">Ghi chú lần xử lý trước: {item.note}</p>}

      <section className="dsec">
        <span className="dsec__title">Giấy tờ đã nộp</span>
        <ul className="dlist">
          {item.documents.length ? (
            item.documents.map((d) => (
              <li key={d.key}>
                <span className="dlist__text">
                  <b>{d.label}</b>
                  <small>{d.ok ? 'Hợp lệ theo đối chiếu tự động' : 'Chưa hợp lệ / cần xem lại'}</small>
                </span>
                <span className={cx('status', d.ok ? 'status--green' : 'status--red')}>{d.ok ? 'Hợp lệ' : 'Lỗi'}</span>
              </li>
            ))
          ) : (
            <li className="dlist__empty">Chưa nộp giấy tờ nào</li>
          )}
        </ul>
        {/* Chưa có kho tài liệu riêng (bucket private + watermark) – xem bản gốc qua quy trình nội bộ */}
        <span className="vf-hint">Tài liệu gốc chỉ xem qua link ký có hạn, có watermark “Chỉ dùng xác minh viecpro”.</span>
      </section>

      <section className="dsec">
        <span className="dsec__title">Checklist đối chiếu thủ công</span>
        <ul className="vf-checklist">
          {(company
            ? ['Tên, mã số thuế khớp Giấy ĐKKD', 'Số GP XKLĐ tra cứu được trên cổng DOLAB, còn hạn', 'Thư uỷ quyền khi người đăng ký không phải đại diện pháp luật', 'Email tên miền công ty đã xác minh']
            : ['Hợp đồng / giấy xác nhận cộng tác với doanh nghiệp có GP XKLĐ', 'Doanh nghiệp đối tác đã bấm xác nhận trên hệ thống', 'Số điện thoại đã xác thực OTP']
          ).map((c) => (
            <li key={c}>
              <IconShieldCheck size={14} />
              {c}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
