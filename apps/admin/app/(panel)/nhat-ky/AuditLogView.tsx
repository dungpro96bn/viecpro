'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditLogItem, Paginated } from '@viecpro/shared';
import Drawer from '@/components/list/Drawer';
import FilterSelect from '@/components/list/FilterSelect';
import Pagination from '@/components/list/Pagination';
import { avatarTone, dateTime, errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import { IconArrowRight, IconList, IconSearch } from '@/components/ui/Icons';
import { api } from '@/lib/api';
import { AUDIT_GROUPS, AUDIT_TARGET_LABEL, auditActionLabel } from '@/lib/audit';
import { cx, initials } from '@/lib/format';

const PAGE_SIZE = 30;
type Group = (typeof AUDIT_GROUPS)[number]['value'];
const TARGET_OPTIONS = [{ value: '', label: 'Tất cả' }, ...Object.entries(AUDIT_TARGET_LABEL).map(([value, label]) => ({ value, label }))];
const PERIODS = [
  { value: '', label: 'Mọi thời gian' },
  { value: '1', label: '24 giờ qua' },
  { value: '7', label: '7 ngày qua' },
  { value: '30', label: '30 ngày qua' },
  { value: '90', label: '90 ngày qua' },
];

/** Hành động nhạy cảm – tô màu để dễ rà soát */
const actionTone = (action: string) =>
  /(lock|ban|suspend|remove|reject|bypassed)$/.test(action) ? 'red' : action.endsWith('pii_view') || action === 'data.export' ? 'orange' : action.startsWith('admin.') ? 'gray' : 'blue';

/** Nhật ký hệ thống (A-12): chỉ đọc – AuditLog không có API sửa / xoá */
export default function AuditLogView() {
  const [group, setGroup] = useState<Group>('');
  const [target, setTarget] = useState('');
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const targetId = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditLogItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (group) p.set('action', group);
      if (target) p.set('targetType', target);
      if (targetId) p.set('targetId', targetId);
      if (period) p.set('from', new Date(Date.now() - Number(period) * 86_400_000).toISOString());
      setData(await api<Paginated<AuditLogItem>>(`/admin/audit-logs?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [page, group, target, targetId, period]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(1), [targetId]);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">Bảng điều khiển / Hệ thống</span>
          <h1 className="page-header__title">Nhật ký hệ thống</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã đối tượng (id)…" aria-label="Tìm theo mã đối tượng" />
          </label>
        </div>
      </header>

      <div className="page-body">
        {error && <p className="alert alert--danger" role="alert">{error}</p>}

        <section className="list-card" aria-label="Nhật ký thao tác">
          <div className="filters">
            <FilterSelect label="Nhóm" value={group} options={AUDIT_GROUPS} onChange={filter(setGroup)} />
            <FilterSelect label="Đối tượng" value={target} options={TARGET_OPTIONS} onChange={filter(setTarget)} />
            <span className="filters__end">
              <FilterSelect label="Thời gian" value={period} options={PERIODS} onChange={filter(setPeriod)} />
            </span>
          </div>

          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>IP</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={6}>
                          <span className="skeleton dtable__skeleton" />
                        </td>
                      </tr>
                    ))
                  : data?.items.map((log) => <AuditRow key={log.id} log={log} onOpen={() => setSelected(log)} />)}
              </tbody>
            </table>
            {data && !data.items.length && (
              <div className="list-empty">
                <IconList size={26} />
                <b>Không có thao tác phù hợp</b>
                Thử bỏ bớt bộ lọc hoặc mở rộng khoảng thời gian.
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="thao tác" onPage={setPage} />}
        </section>
      </div>

      <Drawer open={!!selected} title={selected ? auditActionLabel(selected.action) : ''} subtitle={selected ? dateTime(selected.createdAt) : undefined} onClose={() => setSelected(null)}>
        {selected && <AuditDetail log={selected} />}
      </Drawer>
    </>
  );
}

function AuditRow({ log, onOpen }: { log: AuditLogItem; onOpen: () => void }) {
  return (
    <tr>
      <td data-label="Thời điểm">
        <span className="cell">
          <span className="cell__main">{relativeTime(log.createdAt)}</span>
          <span className="cell__sub">{dateTime(log.createdAt)}</span>
        </span>
      </td>
      <td data-label="Người thực hiện">
        <span className="who">
          <span className={cx('avatar', `avatar--${avatarTone(log.actor.id)}`)}>{initials(log.actor.name)}</span>
          <span className="who__text">
            <span className="who__name">{log.actor.name}</span>
          </span>
        </span>
      </td>
      <td data-label="Hành động">
        <span className={cx('status', `status--${actionTone(log.action)}`)}>{auditActionLabel(log.action)}</span>
      </td>
      <td data-label="Đối tượng">
        <span className="cell">
          <span className="cell__main">{log.targetType ? (AUDIT_TARGET_LABEL[log.targetType] ?? log.targetType) : '—'}</span>
          {log.targetId && <span className="cell__sub audit-id">{log.targetId}</span>}
        </span>
      </td>
      <td data-label="IP">
        <span className="cell__sub audit-id">{log.ip ?? '—'}</span>
      </td>
      <td data-label="Chi tiết">
        <button type="button" className="row-btn" onClick={onOpen}>
          Xem
          <IconArrowRight size={13} />
        </button>
      </td>
    </tr>
  );
}

function AuditDetail({ log }: { log: AuditLogItem }) {
  return (
    <>
      <section className="dsec">
        <span className="dsec__title">Thông tin</span>
        <div className="dgrid">
          <span className="dgrid__item">
            <small>Người thực hiện</small>
            <b>{log.actor.name}</b>
          </span>
          <span className="dgrid__item">
            <small>Mã hành động</small>
            <b className="audit-id">{log.action}</b>
          </span>
          <span className="dgrid__item">
            <small>Đối tượng</small>
            <b>{log.targetType ? (AUDIT_TARGET_LABEL[log.targetType] ?? log.targetType) : '—'}</b>
          </span>
          <span className="dgrid__item">
            <small>Mã đối tượng</small>
            <b className="audit-id">{log.targetId ?? '—'}</b>
          </span>
          <span className="dgrid__item">
            <small>Địa chỉ IP</small>
            <b className="audit-id">{log.ip ?? '—'}</b>
          </span>
          <span className="dgrid__item">
            <small>Thời điểm</small>
            <b>{dateTime(log.createdAt)}</b>
          </span>
        </div>
      </section>
      <AuditData title="Trước khi thay đổi" value={log.before} />
      <AuditData title="Sau khi thay đổi" value={log.after} />
    </>
  );
}

function AuditData({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <section className="dsec">
      <span className="dsec__title">{title}</span>
      <pre className="audit-json">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
