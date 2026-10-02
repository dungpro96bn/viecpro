'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  APPLICATION_STATUS_LABEL,
  GENDER_LABEL,
  INDUSTRIES,
  PROGRAM_LABEL,
  PROGRAMS,
  REPORT_STATUS_LABEL,
  type AdminSeekerDetail,
  type AdminSeekerItem,
  type AdminSeekerList,
  type AdminSeekerStatus,
  type AdminSeekerTab,
  type Industry,
  type Program,
  type RevealedContact,
} from '@viecpro/shared';
import Drawer from '@/components/list/Drawer';
import FilterSelect from '@/components/list/FilterSelect';
import Pagination from '@/components/list/Pagination';
import { avatarTone, dateTime, errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import Dialog from '@/components/ui/Dialog';
import { IconArrowRight, IconCheck, IconEye, IconLock, IconMail, IconPhone, IconSearch, IconUnlock, IconWorkers } from '@/components/ui/Icons';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 20;
const TABS: Array<{ key: AdminSeekerTab; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'seeking', label: 'Đang tìm việc' },
  { key: 'interviewing', label: 'Đang phỏng vấn' },
  { key: 'passed', label: 'Đã trúng tuyển' },
  { key: 'locked', label: 'Tạm khoá' },
];
const SEEKER_STATUS: Record<AdminSeekerStatus, { label: string; tone: string }> = {
  seeking: { label: 'Đang tìm việc', tone: 'blue' },
  interviewing: { label: 'Đang phỏng vấn', tone: 'violet' },
  passed: { label: 'Đã trúng tuyển', tone: 'green' },
  departed: { label: 'Đã xuất cảnh', tone: 'teal' },
  locked: { label: 'Tạm khoá', tone: 'red' },
  idle: { label: 'Tạm ngừng tìm việc', tone: 'gray' },
};
const TOGGLES = [
  { key: 'jlptN3', label: 'JLPT N3+' },
  { key: 'complete80', label: 'Hồ sơ ≥ 80%' },
  { key: 'new7d', label: 'Mới 7 ngày' },
  { key: 'reported', label: 'Bị báo cáo' },
] as const;
type ToggleKey = (typeof TOGGLES)[number]['key'];
const INDUSTRY_OPTIONS = [{ value: '' as const, label: 'Tất cả' }, ...INDUSTRIES.map((i) => ({ value: i, label: i }))] as Array<{ value: Industry | ''; label: string }>;
const PROGRAM_OPTIONS = [{ value: '' as const, label: 'Tất cả' }, ...PROGRAMS.map((p) => ({ value: p, label: PROGRAM_LABEL[p] }))] as Array<{ value: Program | ''; label: string }>;
const SORT_OPTIONS = [
  { value: 'recent' as const, label: 'Hoạt động gần nhất' },
  { value: 'newest' as const, label: 'Mới đăng ký' },
];

const completionLevel = (pct: number) => (pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low');

/** Danh sách ứng viên (design-new 09 – A-04). Liên hệ luôn che; "Hiện" cần quyền users.pii và được ghi nhật ký */
export default function SeekersView() {
  const [tab, setTab] = useState<AdminSeekerTab>('all');
  const [industry, setIndustry] = useState<Industry | ''>('');
  const [program, setProgram] = useState<Program | ''>('');
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ jlptN3: false, complete80: false, new7d: false, reported: false });
  const [sort, setSort] = useState<'recent' | 'newest'>('recent');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminSeekerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tab, sort, page: String(page), limit: String(PAGE_SIZE) });
      if (industry) p.set('industry', industry);
      if (program) p.set('program', program);
      if (q) p.set('q', q);
      for (const t of TOGGLES) if (toggles[t.key]) p.set(t.key, 'true');
      setData(await api<AdminSeekerList>(`/admin/users?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [tab, sort, page, industry, program, q, toggles]);
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
          <h1 className="page-header__title">Danh sách ứng viên</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên, số điện thoại, email, mã UV…" aria-label="Tìm ứng viên" />
          </label>
        </div>
      </header>

      <div className="page-body">
        <section className="lkpis" aria-label="Số liệu ứng viên">
          <article className="lkpi">
            <span className="lkpi__label">Tổng ứng viên</span>
            <b className="lkpi__value">{s ? formatNumber(s.total) : '—'}</b>
            <span className="lkpi__note lkpi__note--good">{s ? `+${formatNumber(s.newThisWeek)} tuần này` : ' '}</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Đang tìm việc</span>
            <b className="lkpi__value">{s ? formatNumber(s.seeking) : '—'}</b>
            <span className="lkpi__note">{s && s.total ? `${Math.round((s.seeking / s.total) * 100)}% tổng số` : ' '}</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Hồ sơ hoàn chỉnh (≥ 80%)</span>
            <b className="lkpi__value">{s ? `${s.completeRate}%` : '—'}</b>
            <span className="lkpi__note">trên tổng số ứng viên</span>
          </article>
          <article className="lkpi">
            <span className="lkpi__label">Bị báo cáo</span>
            <b className="lkpi__value">{s ? formatNumber(s.reported) : '—'}</b>
            <span className={cx('lkpi__note', s?.reportedOpen ? 'lkpi__note--warn' : '')}>{s ? `${formatNumber(s.reportedOpen)} chưa xử lý` : ' '}</span>
          </article>
        </section>

        {error && <p className="alert alert--danger" role="alert">{error}</p>}

        <section className="list-card" aria-label="Ứng viên">
          <div className="tabs" role="tablist" aria-label="Trạng thái ứng viên">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx('tabs__item', tab === t.key && 'tabs__item--active')} onClick={() => filter(setTab)(t.key)}>
                {t.label}
                <span className="tabs__count">{data ? formatNumber(data.tabs[t.key]) : '…'}</span>
              </button>
            ))}
          </div>
          <div className="filters">
            <FilterSelect label="Ngành nghề" value={industry} options={INDUSTRY_OPTIONS} onChange={filter(setIndustry)} />
            <FilterSelect label="Chương trình" value={program} options={PROGRAM_OPTIONS} onChange={filter(setProgram)} />
            <span className="filters__divider" />
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
                  <th>Ứng viên</th>
                  <th>Nguyện vọng</th>
                  <th>JLPT</th>
                  <th>Hồ sơ</th>
                  <th>Hoạt động</th>
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
                  : data?.items.map((u) => <SeekerRow key={u.id} u={u} onOpen={() => setSelectedId(u.id)} />)}
              </tbody>
            </table>
            {data && !data.items.length && (
              <div className="list-empty">
                <IconWorkers size={26} />
                <b>Không có ứng viên phù hợp</b>
                Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm.
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="ứng viên" onPage={setPage} />}
        </section>
      </div>

      <SeekerDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => void load()} />
    </>
  );
}

function SeekerRow({ u, onOpen }: { u: AdminSeekerItem; onOpen: () => void }) {
  const st = SEEKER_STATUS[u.status];
  const level = completionLevel(u.completion);
  const meta = [u.code, [u.gender && GENDER_LABEL[u.gender], u.age].filter(Boolean).join(', '), u.hometown].filter(Boolean).join(' · ');
  return (
    <tr>
      <td data-label="Ứng viên">
        <span className="who">
          <span className={cx('avatar', `avatar--${avatarTone(u.id)}`)}>{initials(u.name)}</span>
          <span className="who__text">
            <span className="who__name">
              {u.name}
              {u.isNew && <span className="mini-tag mini-tag--new">Mới</span>}
              {u.reportCount > 0 && <span className="mini-tag mini-tag--danger">Báo cáo {u.reportCount}</span>}
            </span>
            <span className="who__sub">{meta}</span>
          </span>
        </span>
      </td>
      <td data-label="Nguyện vọng">
        <span className="cell sk-wish">
          <span className="cell__main">{u.industry ?? 'Chưa chọn ngành'}</span>
          <span className="cell__sub">{u.program ? PROGRAM_LABEL[u.program] : '—'}</span>
        </span>
      </td>
      <td data-label="JLPT">{u.jlpt ? <span className="sk-jlpt">{u.jlpt}</span> : <span className="cell__sub">Chưa có</span>}</td>
      <td data-label="Hồ sơ">
        <span className="meter">
          <span className="meter__track">
            <i className={cx('meter__bar', `meter__bar--${level}`)} style={{ width: `${u.completion}%` }} />
          </span>
          <span className={cx('meter__value', `meter__value--${level}`)}>{u.completion}%</span>
        </span>
      </td>
      <td data-label="Hoạt động">
        <span className="cell">
          <span className="cell__main">{u.applicationCount} đơn ứng tuyển</span>
          <span className="cell__sub">{relativeTime(u.lastActiveAt)}</span>
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

/** Ngăn kéo hồ sơ ứng viên: liên hệ (che / hiện có ghi nhật ký), nguyện vọng, đơn ứng tuyển, báo cáo, khoá tài khoản */
function SeekerDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const [detail, setDetail] = useState<AdminSeekerDetail | null>(null);
  const [contact, setContact] = useState<RevealedContact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDetail(null);
    setContact(null);
    setError(null);
    if (!id) return;
    api<AdminSeekerDetail>(`/admin/users/${id}`)
      .then(setDetail)
      .catch((e: unknown) => setError(errorText(e)));
  }, [id]);

  const reveal = async () => {
    if (!detail) return;
    try {
      setContact(await post<RevealedContact>(`/admin/users/${detail.id}/reveal`));
    } catch (e) {
      setError(errorText(e));
    }
  };
  const act = async (path: 'lock' | 'unlock', reason?: string) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await post<AdminSeekerDetail>(`/admin/users/${detail.id}/${path}`, reason ? { reason } : undefined));
      setLocking(false);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const st = detail && SEEKER_STATUS[detail.status];
  return (
    <>
      <Drawer
        open={!!id}
        title={detail?.name ?? 'Hồ sơ ứng viên'}
        subtitle={detail && `${detail.code} · Tham gia ${new Date(detail.createdAt).toLocaleDateString('vi-VN')}`}
        onClose={onClose}
        footer={
          detail &&
          can('users.lock') &&
          (detail.lockedAt ? (
            <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void act('unlock')}>
              <IconUnlock size={15} />
              Mở khoá tài khoản
            </button>
          ) : (
            <button type="button" className="btn btn--danger-outline" disabled={busy} onClick={() => setLocking(true)}>
              <IconLock size={15} />
              Khoá tài khoản
            </button>
          ))
        }
      >
        {error && <p className="alert alert--danger" role="alert">{error}</p>}
        {!detail && !error && <span className="skeleton sk-drawer-skeleton" aria-busy="true" />}
        {detail && st && (
          <>
            {detail.lockedAt && (
              <p className="dnote">
                Tài khoản bị khoá từ {dateTime(detail.lockedAt)}
                {detail.lockReason && ` – ${detail.lockReason}`}
              </p>
            )}
            <div className="dgrid">
              <span className="dgrid__item">
                <small>Trạng thái</small>
                <b>
                  <span className={cx('status', `status--${st.tone}`)}>{st.label}</span>
                </b>
              </span>
              <span className="dgrid__item">
                <small>Hồ sơ hoàn thiện</small>
                <b>{detail.completion}%</b>
              </span>
              <span className="dgrid__item">
                <small>Giới tính · tuổi</small>
                <b>{[detail.gender && GENDER_LABEL[detail.gender], detail.age && `${detail.age} tuổi`].filter(Boolean).join(' · ') || '—'}</b>
              </span>
              <span className="dgrid__item">
                <small>Quê quán</small>
                <b>{detail.hometown ?? '—'}</b>
              </span>
            </div>

            <section className="dsec">
              <span className="dsec__title">Liên hệ</span>
              <ul className="dlist">
                <li>
                  <span className="dlist__text sk-contact">
                    <IconPhone size={14} />
                    {contact ? (contact.phone ?? '—') : (detail.phoneMasked ?? 'Chưa có')}
                  </span>
                  <span className="dlist__text sk-contact">
                    <IconMail size={14} />
                    {contact ? (contact.email ?? '—') : (detail.emailMasked ?? 'Chưa có')}
                  </span>
                </li>
              </ul>
              {can('users.pii') && !contact && (
                <button type="button" className="row-btn sk-reveal" onClick={() => void reveal()}>
                  <IconEye size={14} />
                  Hiện đầy đủ (ghi nhật ký)
                </button>
              )}
            </section>

            <section className="dsec">
              <span className="dsec__title">Nguyện vọng</span>
              <div className="dgrid">
                <span className="dgrid__item">
                  <small>Chương trình</small>
                  <b>{detail.programs.map((p) => PROGRAM_LABEL[p]).join(', ') || '—'}</b>
                </span>
                <span className="dgrid__item">
                  <small>Ngành nghề</small>
                  <b>{detail.industries.join(', ') || '—'}</b>
                </span>
                <span className="dgrid__item">
                  <small>Tỉnh Nhật Bản</small>
                  <b>{detail.prefs.join(', ') || '—'}</b>
                </span>
                <span className="dgrid__item">
                  <small>Tiếng Nhật</small>
                  <b>{detail.jlpt ?? 'Chưa có'}</b>
                </span>
              </div>
            </section>

            <section className="dsec">
              <span className="dsec__title">Đơn ứng tuyển ({detail.applicationCount})</span>
              <ul className="dlist">
                {detail.applications.length ? (
                  detail.applications.map((a) => (
                    <li key={a.id}>
                      <span className="dlist__text">
                        <b>{a.jobTitle}</b>
                        <small>
                          {a.employerName ?? 'NTD cá nhân'} · {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                        </small>
                      </span>
                      <span className="mini-tag mini-tag--gray">{APPLICATION_STATUS_LABEL[a.status]}</span>
                    </li>
                  ))
                ) : (
                  <li className="dlist__empty">Chưa ứng tuyển đơn nào</li>
                )}
              </ul>
            </section>

            <section className="dsec">
              <span className="dsec__title">Báo cáo vi phạm</span>
              <ul className="dlist">
                {detail.reports.length ? (
                  detail.reports.map((r) => (
                    <li key={r.code}>
                      <span className="dlist__text">
                        <b>{r.reason}</b>
                        <small>
                          {r.code} · {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                        </small>
                      </span>
                      <span className="mini-tag mini-tag--gray">{REPORT_STATUS_LABEL[r.status]}</span>
                    </li>
                  ))
                ) : (
                  <li className="dlist__empty">
                    <IconCheck size={14} /> Không có báo cáo nào
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </Drawer>

      <Dialog
        open={locking}
        title="Khoá tài khoản ứng viên"
        description={detail ? `“${detail.name}” sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi mở khoá.` : undefined}
        input={{ label: 'Lý do khoá', placeholder: 'Ví dụ: Giả mạo thông tin, quấy rối nhà tuyển dụng…', required: true, minLength: 5 }}
        confirmLabel="Khoá tài khoản"
        tone="danger"
        busy={busy}
        error={locking ? error : null}
        onConfirm={(reason) => void act('lock', reason)}
        onClose={() => setLocking(false)}
      />
    </>
  );
}
