'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminLeadItem, AdminLeadList } from '@viecpro/shared';
import Pagination from '@/components/list/Pagination';
import { dateTime, errorText } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import { IconCheck, IconPhone, IconSearch } from '@/components/ui/Icons';
import { api, post, WEB_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx } from '@/lib/format';

const PAGE_SIZE = 30;
const TABS = [
  { key: 'unhandled', label: 'Chưa xử lý' },
  { key: 'handled', label: 'Đã xử lý' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/** Danh sách khách để lại thông tin nhờ tư vấn */
export default function LeadsView() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('unhandled');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminLeadList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tab, page: String(page), limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      setData(await api<AdminLeadList>(`/admin/leads?${params.toString()}`));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [tab, page, q]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => setPage(1), [q]);

  const markHandled = async (lead: AdminLeadItem) => {
    setSaving(lead.id);
    setError(null);
    try {
      await post(`/admin/leads/${lead.id}/handle`);
      await load();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(null);
    }
  };

  const canSeePhone = can('users.pii');
  const canHandle = can('leads.manage');

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">Bảng điều khiển / Vận hành</span>
          <h1 className="page-header__title">Khách cần tư vấn</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, số điện thoại, tin đăng…" aria-label="Tìm khách cần tư vấn" />
          </label>
        </div>
      </header>

      <div className="page-body">
        {error && <p className="alert alert--danger" role="alert">{error}</p>}
        <section className="list-card" aria-label="Danh sách khách cần tư vấn">
          <div className="tabs" role="tablist" aria-label="Trạng thái khách cần tư vấn">
            {TABS.map((item) => (
              <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={cx('tabs__item', tab === item.key && 'tabs__item--active')} onClick={() => { setTab(item.key); setPage(1); }}>
                {item.label}
                <span className="tabs__count">{data ? data.tabs[item.key].toLocaleString('vi-VN') : '…'}</span>
              </button>
            ))}
          </div>

          <div className="dtable-wrap">
            <table className="dtable lead-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Liên hệ</th>
                  <th>Nhu cầu</th>
                  <th>Thời điểm</th>
                  {canHandle && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  Array.from({ length: 6 }, (_, index) => <tr key={index}><td colSpan={canHandle ? 5 : 4}><span className="skeleton dtable__skeleton" /></td></tr>)
                ) : data?.items.map((lead) => <LeadRow key={lead.id} lead={lead} canSeePhone={canSeePhone} canHandle={canHandle} saving={saving === lead.id} onHandle={() => void markHandled(lead)} />)}
              </tbody>
            </table>
            {data && !data.items.length && (
              <div className="list-empty">
                <IconPhone size={22} />
                <b>{q ? 'Không tìm thấy khách phù hợp' : tab === 'unhandled' ? 'Chưa có khách chờ tư vấn' : 'Chưa có khách đã xử lý'}</b>
                <span>Khách gửi yêu cầu từ các trang công khai sẽ xuất hiện tại đây.</span>
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="khách" onPage={setPage} />}
        </section>
      </div>
    </>
  );
}

function LeadRow({ lead, canSeePhone, canHandle, saving, onHandle }: { lead: AdminLeadItem; canSeePhone: boolean; canHandle: boolean; saving: boolean; onHandle: () => void }) {
  const need = lead.job
    ? <a href={`${WEB_URL}/viec-lam/${lead.job.slug}`} target="_blank" rel="noreferrer" className="cell__main lead-job">{lead.job.title}</a>
    : <span className="cell__main">{lead.employer?.name ?? lead.recruiter?.name ?? 'Tư vấn chung'}</span>;
  const secondary = lead.job ? (lead.employer?.name ?? lead.recruiter?.name) : null;
  return (
    <tr>
      <td><div className="cell"><span className="cell__main">{lead.name}</span><span className="cell__sub">{lead.handledAt ? `Đã xử lý ${dateTime(lead.handledAt)}` : 'Đang chờ liên hệ'}</span></div></td>
      <td>
        {canSeePhone ? <a className="lead-phone" href={`tel:${lead.phone}`}><IconPhone size={14} />{lead.phone}</a> : <span className="lead-phone lead-phone--masked"><IconPhone size={14} />{lead.phone}</span>}
      </td>
      <td><div className="cell">{need}{secondary && <span className="cell__sub">{secondary}</span>}</div></td>
      <td><span className="cell__sub">{dateTime(lead.createdAt)}</span></td>
      {canHandle && <td>{!lead.handledAt && <button type="button" className="btn btn--soft btn--sm lead-handle" disabled={saving} onClick={onHandle}><IconCheck size={14} />{saving ? 'Đang lưu…' : 'Đã liên hệ'}</button>}</td>}
    </tr>
  );
}
