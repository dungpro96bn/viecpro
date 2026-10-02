'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  JOB_STATUS_LABEL,
  REPORT_DECISION_LABEL,
  REPORT_STATUS_LABEL,
  type AdminEmployerDetail,
  type AdminEmployerItem,
  type AdminEmployerKind,
  type AdminEmployerList,
  type AdminEmployerListQuery,
  type AdminEmployerStatus,
  type AdminEmployerTab,
} from '@viecpro/shared';
import Drawer from '@/components/list/Drawer';
import FilterSelect from '@/components/list/FilterSelect';
import Pagination from '@/components/list/Pagination';
import { avatarTone, dateTime, errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import Dialog from '@/components/ui/Dialog';
import { IconAlert, IconArrowRight, IconBriefcase, IconHistory, IconLock, IconSearch, IconShieldCheck, IconUnlock } from '@/components/ui/Icons';
import { api, post } from '@/lib/api';
import { auditActionLabel } from '@/lib/audit';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 20;
const KINDS: Array<{ key: AdminEmployerKind; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'company', label: 'Công ty XKLĐ' },
  { key: 'individual', label: 'NTD cá nhân' },
];
const TABS: Array<{ key: AdminEmployerTab; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Đang hoạt động' },
  { key: 'pending', label: 'Chờ xác minh' },
  { key: 'expiring', label: 'Sắp hết gói' },
  { key: 'suspended', label: 'Tạm khoá' },
];
const STATUS: Record<AdminEmployerStatus, { label: string; tone: string }> = {
  active: { label: 'Đang hoạt động', tone: 'green' },
  pending: { label: 'Chờ xác minh', tone: 'blue' },
  expiring: { label: 'Sắp hết gói', tone: 'orange' },
  suspended: { label: 'Tạm khoá', tone: 'red' },
};
const TOGGLES = [
  { key: 'verified', label: 'Đã xác minh' },
  { key: 'paid', label: 'Gói trả phí' },
  { key: 'slowResponse', label: 'Phản hồi chậm' },
  { key: 'reported', label: 'Bị báo cáo' },
] as const;
type ToggleKey = (typeof TOGGLES)[number]['key'];
const SORT_OPTIONS: Array<{ value: AdminEmployerListQuery['sort']; label: string }> = [
  { value: 'applicants', label: 'Nhiều ứng viên nhất' },
  { value: 'jobs', label: 'Nhiều tin đang đăng' },
  { value: 'reports', label: 'Nhiều báo cáo nhất' },
  { value: 'newest', label: 'Mới tham gia' },
];
const DETAIL_TABS = ['overview', 'jobs', 'plan', 'violations', 'history'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];
const DETAIL_TAB_LABEL: Record<DetailTab, string> = { overview: 'Tổng quan', jobs: 'Tin đăng', plan: 'Gói & thanh toán', violations: 'Vi phạm', history: 'Lịch sử' };

const rateLevel = (r: number) => (r >= 80 ? 'good' : r >= 60 ? 'mid' : 'low');

/** Nhà tuyển dụng (design-new 10 – A-05): gộp công ty XKLĐ và NTD cá nhân */
export default function EmployersView() {
  const [kind, setKind] = useState<AdminEmployerKind>('all');
  const [tab, setTab] = useState<AdminEmployerTab>('all');
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ verified: false, paid: false, slowResponse: false, reported: false });
  const [sort, setSort] = useState<AdminEmployerListQuery['sort']>('applicants');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminEmployerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminEmployerItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ kind, tab, sort, page: String(page), limit: String(PAGE_SIZE) });
      if (q) p.set('q', q);
      for (const t of TOGGLES) if (toggles[t.key]) p.set(t.key, 'true');
      setData(await api<AdminEmployerList>(`/admin/employers?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [kind, tab, sort, page, q, toggles]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(1), [q]);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const s = data?.stats;

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">Bảng điều khiển / Vận hành</span>
          <h1 className="page-header__title">Nhà tuyển dụng</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên, MST, số điện thoại…" aria-label="Tìm nhà tuyển dụng" />
          </label>
        </div>
      </header>

      <div className="page-body">
        <section className="lkpis" aria-label="Số liệu nhà tuyển dụng">
          <article className="lkpi">
            <span className="lkpi__label">Tổng nhà tuyển dụng</span>
            <b className="lkpi__value">{s ? formatNumber(s.total) : '—'}</b>
            <span className="lkpi__note lkpi__note--good">{s ? `+${formatNumber(s.newThisMonth)} tháng này` : ' '}</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Đang có tin đăng</span>
            <b className="lkpi__value">{s ? formatNumber(s.withOpenJobs) : '—'}</b>
            <span className="lkpi__note">{s && s.total ? `${Math.round((s.withOpenJobs / s.total) * 100)}% tổng số tài khoản` : ' '}</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Gói trả phí</span>
            <b className="lkpi__value">{s ? formatNumber(s.paid) : '—'}</b>
            <span className="lkpi__note">đang còn hạn</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Sắp hết gói (30 ngày)</span>
            <b className="lkpi__value">{s ? formatNumber(s.expiring) : '—'}</b>
            <span className={cx('lkpi__note', s?.expiring ? 'lkpi__note--warn' : '')}>cần liên hệ gia hạn</span>
          </article>
        </section>

        <div className="em-kinds" role="radiogroup" aria-label="Loại nhà tuyển dụng">
          {KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={cx('em-kind', kind === k.key && 'em-kind--on')} onClick={() => filter(setKind)(k.key)}>
              <b>{k.label}</b>
              <span>{data ? `${formatNumber(data.kinds[k.key])} tài khoản` : '…'}</span>
            </button>
          ))}
        </div>

        {error && <p className="alert alert--danger" role="alert">{error}</p>}

        <section className="list-card" aria-label="Nhà tuyển dụng">
          <div className="tabs" role="tablist" aria-label="Trạng thái">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx('tabs__item', tab === t.key && 'tabs__item--active')} onClick={() => filter(setTab)(t.key)}>
                {t.label}
                <span className="tabs__count">{data ? formatNumber(data.tabs[t.key]) : '…'}</span>
              </button>
            ))}
          </div>
          <div className="filters">
            {TOGGLES.map((t) => (
              <button key={t.key} type="button" aria-pressed={toggles[t.key]} className={cx('chip-toggle', toggles[t.key] && 'chip-toggle--on')} onClick={() => filter(setToggles)({ ...toggles, [t.key]: !toggles[t.key] })}>
                {t.label}
              </button>
            ))}
            <span className="filters__end">
              <FilterSelect label="Sắp xếp" value={sort} options={SORT_OPTIONS} onChange={filter(setSort)} />
            </span>
          </div>

          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Nhà tuyển dụng</th>
                  <th>Tin đăng</th>
                  <th>Ứng viên 30N</th>
                  <th>Phản hồi</th>
                  <th>Gói dịch vụ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={7}>
                          <span className="skeleton dtable__skeleton" />
                        </td>
                      </tr>
                    ))
                  : data?.items.map((e) => <EmployerRow key={e.key} e={e} onOpen={() => setSelected(e)} />)}
              </tbody>
            </table>
            {data && !data.items.length && (
              <div className="list-empty">
                <IconBriefcase size={26} />
                <b>Không có nhà tuyển dụng phù hợp</b>
                Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm.
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="nhà tuyển dụng" onPage={setPage} />}
        </section>
      </div>

      <EmployerDrawer item={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />
    </>
  );
}

function EmployerRow({ e, onOpen }: { e: AdminEmployerItem; onOpen: () => void }) {
  const st = STATUS[e.status];
  return (
    <tr>
      <td data-label="Nhà tuyển dụng">
        <span className="who">
          <span className={cx('avatar avatar--square', `avatar--${avatarTone(e.key)}`)}>{e.logoUrl ? <img src={e.logoUrl} alt="" /> : initials(e.name)}</span>
          <span className="who__text">
            <span className="who__name">
              {e.name}
              {e.verified && <IconShieldCheck size={14} className="em-verified" aria-label="Đã xác minh" />}
              <span className={cx('mini-tag', e.kind === 'company' ? 'mini-tag--blue' : 'mini-tag--gray')}>{e.kind === 'company' ? 'Công ty' : 'Cá nhân'}</span>
              <span className={cx('mini-tag', e.reportCount ? 'mini-tag--danger' : 'mini-tag--gray')}>Báo cáo {e.reportCount}</span>
            </span>
            <span className="who__sub">{e.subtitle || '—'}</span>
          </span>
        </span>
      </td>
      <td data-label="Tin đăng">
        <span className="cell">
          <span className="cell__main">{formatNumber(e.openJobs)} đang đăng</span>
          <span className="cell__sub">Tổng {formatNumber(e.totalJobs)} tin</span>
        </span>
      </td>
      <td data-label="Ứng viên 30N">
        <span className="cell">
          <span className="cell__main">{e.applicants30d ? formatNumber(e.applicants30d) : '—'}</span>
          {e.applicantsDelta !== null && (
            <span className={cx('cell__sub', e.applicantsDelta >= 0 ? 'em-up' : 'em-down')}>
              {e.applicantsDelta >= 0 ? '↑' : '↓'} {Math.abs(e.applicantsDelta)}%
            </span>
          )}
        </span>
      </td>
      <td data-label="Phản hồi">
        {e.responseRate === null ? (
          <span className="cell__sub">—</span>
        ) : (
          <span className="meter">
            <span className="meter__track">
              <i className={cx('meter__bar', `meter__bar--${rateLevel(e.responseRate)}`)} style={{ width: `${e.responseRate}%` }} />
            </span>
            <span className={cx('meter__value', `meter__value--${rateLevel(e.responseRate)}`)}>{e.responseRate}%</span>
          </span>
        )}
      </td>
      <td data-label="Gói dịch vụ">
        <span className="cell">
          <span className="cell__main">{e.plan?.name ?? 'Miễn phí'}</span>
          <span className={cx('cell__sub', e.plan && e.plan.daysLeft <= 30 && 'em-down')}>
            {e.plan ? (e.plan.daysLeft <= 30 ? `Còn ${e.plan.daysLeft} ngày` : `Đến ${new Date(e.plan.expiresAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}`) : 'Không giới hạn'}
          </span>
        </span>
      </td>
      <td data-label="Trạng thái">
        <span className={cx('status', `status--${st.tone}`)}>{st.label}</span>
      </td>
      <td data-label="Thao tác">
        <button type="button" className="row-btn" onClick={onOpen}>
          Xem chi tiết
          <IconArrowRight size={13} />
        </button>
      </td>
    </tr>
  );
}

type Sanction = 'warn' | 'suspend';

/** Ngăn kéo NTD: 5 tab Tổng quan / Tin đăng / Gói & thanh toán / Vi phạm / Lịch sử + cảnh cáo, tạm khoá, mở khoá */
function EmployerDrawer({ item, onClose, onChanged }: { item: AdminEmployerItem | null; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const [detail, setDetail] = useState<AdminEmployerDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sanction, setSanction] = useState<Sanction | null>(null);
  const [busy, setBusy] = useState(false);
  const path = item && `/admin/employers/${item.kind}/${item.id}`;

  useEffect(() => {
    setDetail(null);
    setError(null);
    setNotice(null);
    setTab('overview');
    if (!path) return;
    api<AdminEmployerDetail>(path)
      .then(setDetail)
      .catch((e: unknown) => setError(errorText(e)));
  }, [path]);

  const act = async (action: Sanction | 'unsuspend', reason?: string, otp?: string) => {
    if (!path) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await post<AdminEmployerDetail>(`${path}/${action}`, action === 'unsuspend' ? undefined : { reason, ...(otp && { otp }) }));
      setSanction(null);
      setNotice(action === 'warn' ? 'Đã gửi cảnh cáo tới nhà tuyển dụng.' : action === 'suspend' ? 'Đã tạm khoá: tin đang hiển thị bị ẩn, thành viên bị đăng xuất.' : 'Đã mở khoá và khôi phục các tin bị ẩn do tạm khoá.');
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const suspended = detail?.status === 'suspended';
  return (
    <>
      <Drawer
        open={!!item}
        title={item?.name}
        subtitle={item && `${item.kind === 'company' ? 'Công ty XKLĐ' : 'NTD cá nhân'} · ${item.subtitle || '—'}`}
        onClose={onClose}
        footer={
          detail && (
            <>
              {can('jobs.moderate') && (
                <button type="button" className="btn btn--warning-outline" disabled={busy} onClick={() => setSanction('warn')}>
                  <IconAlert size={15} />
                  Cảnh cáo
                </button>
              )}
              {can('users.lock') &&
                (suspended ? (
                  <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void act('unsuspend')}>
                    <IconUnlock size={15} />
                    Mở khoá
                  </button>
                ) : (
                  <button type="button" className="btn btn--danger-outline" disabled={busy} onClick={() => setSanction('suspend')}>
                    <IconLock size={15} />
                    Tạm khoá
                  </button>
                ))}
            </>
          )
        }
      >
        {error && !sanction && <p className="alert alert--danger" role="alert">{error}</p>}
        {notice && <p className="list-notice" role="status">{notice}</p>}
        {!detail && !error && <span className="skeleton em-drawer-skeleton" aria-busy="true" />}
        {detail && (
          <>
            {suspended && detail.suspendReason && <p className="dnote">Đang tạm khoá{detail.suspendedAt && ` từ ${dateTime(detail.suspendedAt)}`}: {detail.suspendReason}</p>}
            <div className="dtabs" role="tablist" aria-label="Thông tin nhà tuyển dụng">
              {DETAIL_TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={cx('dtabs__item', tab === t && 'dtabs__item--on')} onClick={() => setTab(t)}>
                  {DETAIL_TAB_LABEL[t]}
                  {t === 'violations' && detail.violations.length > 0 && ` (${detail.violations.length})`}
                </button>
              ))}
            </div>
            {tab === 'overview' && <Overview d={detail} />}
            {tab === 'jobs' && (
              <ul className="dlist">
                {detail.jobs.length ? (
                  detail.jobs.map((j) => (
                    <li key={j.id}>
                      <span className="dlist__text">
                        <b>{j.title}</b>
                        <small>
                          {j.code} · {formatNumber(j.applicants)} hồ sơ · {new Date(j.createdAt).toLocaleDateString('vi-VN')}
                        </small>
                      </span>
                      <span className={cx('mini-tag', j.suspended ? 'mini-tag--danger' : j.status === 'open' ? 'mini-tag--new' : 'mini-tag--gray')}>{j.suspended ? 'Bị ẩn' : JOB_STATUS_LABEL[j.status]}</span>
                    </li>
                  ))
                ) : (
                  <li className="dlist__empty">Chưa đăng tin nào</li>
                )}
              </ul>
            )}
            {tab === 'plan' && (
              <div className="dgrid">
                <span className="dgrid__item">
                  <small>Gói hiện tại</small>
                  <b>{detail.plan?.name ?? 'Miễn phí'}</b>
                </span>
                <span className="dgrid__item">
                  <small>Hết hạn</small>
                  <b>{detail.plan ? `${new Date(detail.plan.expiresAt).toLocaleDateString('vi-VN')} (còn ${detail.plan.daysLeft} ngày)` : 'Không giới hạn'}</b>
                </span>
                {/* Chưa có module thanh toán (M17) – lịch sử hoá đơn / đổi gói thủ công sẽ thêm ở Phase 7 */}
                <span className="dgrid__item em-span">
                  <small>Lịch sử thanh toán</small>
                  <b>Chưa có dữ liệu giao dịch – module thanh toán đang được xây dựng</b>
                </span>
              </div>
            )}
            {tab === 'violations' && (
              <ul className="dlist">
                {detail.violations.length ? (
                  detail.violations.map((v) => (
                    <li key={v.code}>
                      <span className="dlist__text">
                        <b>{v.reason}</b>
                        <small>
                          {v.code} · {new Date(v.createdAt).toLocaleDateString('vi-VN')}
                          {v.decision && ` · ${REPORT_DECISION_LABEL[v.decision]}`}
                        </small>
                      </span>
                      <span className={cx('mini-tag', v.status === 'resolved' ? 'mini-tag--danger' : v.status === 'dismissed' ? 'mini-tag--gray' : 'mini-tag--warning')}>{REPORT_STATUS_LABEL[v.status]}</span>
                    </li>
                  ))
                ) : (
                  <li className="dlist__empty">Chưa có báo cáo vi phạm</li>
                )}
              </ul>
            )}
            {tab === 'history' && (
              <ul className="dlist">
                {detail.history.length ? (
                  detail.history.map((h) => (
                    <li key={h.id}>
                      <span className="dlist__text">
                        <b>{auditActionLabel(h.action)}</b>
                        <small>
                          {h.actor.name} · {dateTime(h.createdAt)}
                          {typeof (h.after as { reason?: unknown } | null)?.reason === 'string' && ` · ${(h.after as { reason: string }).reason}`}
                        </small>
                      </span>
                      <IconHistory size={15} className="em-history-icon" />
                    </li>
                  ))
                ) : (
                  <li className="dlist__empty">Chưa có thao tác quản trị nào</li>
                )}
              </ul>
            )}
          </>
        )}
      </Drawer>

      <Dialog
        open={!!sanction}
        title={sanction === 'suspend' ? 'Tạm khoá nhà tuyển dụng' : 'Cảnh cáo nhà tuyển dụng'}
        description={
          sanction === 'suspend'
            ? `Mọi tin đang hiển thị của “${item?.name}” sẽ bị ẩn, thành viên bị đăng xuất và không đăng nhập được cho tới khi mở khoá.`
            : `Nội dung cảnh cáo được gửi tới mọi thành viên của “${item?.name}” và ghi vào lịch sử.`
        }
        input={{ label: 'Lý do', placeholder: sanction === 'suspend' ? 'Ví dụ: Thu phí ngoài hợp đồng, đã xác minh qua 3 báo cáo…' : 'Ví dụ: Phản hồi ứng viên chậm quá 5 ngày…', required: true, minLength: 5 }}
        otp={sanction === 'suspend'}
        confirmLabel={sanction === 'suspend' ? 'Tạm khoá' : 'Gửi cảnh cáo'}
        tone={sanction === 'suspend' ? 'danger' : 'warning'}
        busy={busy}
        error={sanction ? error : null}
        onConfirm={(reason, otp) => sanction && void act(sanction, reason, otp)}
        onClose={() => setSanction(null)}
      />
    </>
  );
}

function Overview({ d }: { d: AdminEmployerDetail }) {
  const st = STATUS[d.status];
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
          <small>Tham gia</small>
          <b>{relativeTime(d.createdAt)}</b>
        </span>
        <span className="dgrid__item">
          <small>Tin đăng</small>
          <b>
            {formatNumber(d.openJobs)} đang đăng / {formatNumber(d.totalJobs)} tin
          </b>
        </span>
        <span className="dgrid__item">
          <small>Ứng viên 30 ngày</small>
          <b>
            {formatNumber(d.applicants30d)}
            {d.applicantsDelta !== null && ` (${d.applicantsDelta >= 0 ? '+' : ''}${d.applicantsDelta}%)`}
          </b>
        </span>
        <span className="dgrid__item">
          <small>Tỉ lệ phản hồi (90 ngày)</small>
          <b>{d.responseRate === null ? '—' : `${d.responseRate}%`}</b>
        </span>
        <span className="dgrid__item">
          <small>Xác minh</small>
          <b>{d.verified ? 'Đã xác minh' : 'Chưa xác minh'}</b>
        </span>
      </div>

      <section className="dsec">
        <span className="dsec__title">Liên hệ</span>
        <div className="dgrid">
          <span className="dgrid__item">
            <small>Điện thoại</small>
            <b>{d.contact.phone ?? '—'}</b>
          </span>
          <span className="dgrid__item">
            <small>Email</small>
            <b>{d.contact.email ?? '—'}</b>
          </span>
          <span className="dgrid__item">
            <small>Website</small>
            <b>{d.contact.website ?? '—'}</b>
          </span>
          <span className="dgrid__item">
            <small>Địa chỉ</small>
            <b>{d.contact.address ?? '—'}</b>
          </span>
        </div>
      </section>

      <section className="dsec">
        <span className="dsec__title">{d.kind === 'company' ? `Thành viên (${d.members.length})` : 'Tài khoản'}</span>
        <ul className="dlist">
          {d.members.map((m) => (
            <li key={m.id}>
              <span className="dlist__text">
                <b>{m.name}</b>
                <small>{m.title}</small>
              </span>
              {m.locked && <span className="mini-tag mini-tag--danger">Đã khoá</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="dsec">
        <span className="dsec__title">{d.kind === 'company' ? 'CTV / NTD cá nhân liên kết' : 'Đơn vị liên kết'}</span>
        <ul className="dlist">
          {d.partners.length ? (
            d.partners.map((p) => (
              <li key={p.id}>
                <span className="dlist__text">
                  <b>{p.name}</b>
                  <small>{p.expiresAt ? `Hạn liên kết ${new Date(p.expiresAt).toLocaleDateString('vi-VN')}` : 'Không thời hạn'}</small>
                </span>
              </li>
            ))
          ) : (
            <li className="dlist__empty">Chưa có liên kết</li>
          )}
        </ul>
      </section>
    </>
  );
}
