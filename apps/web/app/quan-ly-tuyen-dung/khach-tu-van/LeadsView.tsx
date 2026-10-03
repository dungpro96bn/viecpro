'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { EmployerLeadList, LeadItem } from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import Pager from '@/components/employer/Pager';
import { IconCheck, IconPhone } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { displayPhone, timeAgo } from '@/lib/employer';
import { cx } from '@/lib/format';

const PER_PAGE = 20;
const TABS = [
  { key: 'unhandled', label: 'Chưa liên hệ' },
  { key: 'handled', label: 'Đã liên hệ' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/** Nguồn khách: tin cụ thể, cán bộ được nhờ, hoặc trang công ty */
function source(lead: LeadItem) {
  if (lead.job) return <>Tin <Link href={`/viec-lam/${lead.job.slug}`}>{lead.job.title}</Link></>;
  if (lead.recruiter) return <>Nhờ {lead.recruiter.name} tư vấn</>;
  return <>Trang công ty</>;
}

/** Khách để lại số điện thoại nhờ tư vấn – gọi lại rồi đánh dấu đã liên hệ */
export default function LeadsView() {
  const { refresh } = useEmployerAccount();
  const [tab, setTab] = useState<Tab>('unhandled');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EmployerLeadList | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<EmployerLeadList>(`/employer/leads?tab=${tab}&page=${page}&limit=${PER_PAGE}`));
      setError('');
    } catch (e) {
      setError(apiMessage(e, 'Không tải được danh sách khách cần tư vấn.'));
    }
  }, [tab, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const markHandled = async (lead: LeadItem) => {
    setBusyId(lead.id);
    setError('');
    try {
      await apiRequest<void>(`/employer/leads/${encodeURIComponent(lead.id)}/handle`, { method: 'POST' });
      await load();
      void refresh();
    } catch (e) {
      setError(apiMessage(e, 'Không cập nhật được.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="eld">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Khách cần tư vấn</span>
          </nav>
          <h1 className="emp-page-head__title">Khách cần tư vấn</h1>
        </span>
      </div>
      <p className="eld__intro">Người lao động để lại số điện thoại ở trang công ty, trang cán bộ hoặc tin tuyển dụng. Gọi lại sớm giúp giữ chân khách – sau khi gọi, bấm “Đã liên hệ”.</p>

      <section className="emp-card eld-card" aria-label="Danh sách khách cần tư vấn">
        <div className="eld-tabs" role="tablist" aria-label="Trạng thái liên hệ">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={cx('eld-tabs__tab', tab === t.key && 'eld-tabs__tab--active')}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
            >
              {t.label}
              {data && <span className="eld-tabs__count">{data.tabs[t.key]}</span>}
            </button>
          ))}
        </div>

        {error && (
          <div className="emp-state emp-state--error" role="alert">
            {error}
          </div>
        )}
        {!data && !error && <p className="emp-state" role="status">Đang tải…</p>}
        {data && !data.items.length && (
          <div className="eld-empty">
            <IconPhone size={26} />
            <b>{tab === 'unhandled' ? 'Không còn khách nào chờ gọi lại' : 'Chưa có khách nào được đánh dấu đã liên hệ'}</b>
          </div>
        )}
        {data && data.items.length > 0 && (
          <>
            <ul className="eld-list">
              {data.items.map((lead) => (
                <li key={lead.id} className="eld-row">
                  <span className="eld-row__who">
                    <b>{lead.name}</b>
                    <a href={`tel:${lead.phone}`} className="eld-row__phone">
                      <IconPhone size={14} />
                      {displayPhone(lead.phone)}
                    </a>
                  </span>
                  <span className="eld-row__meta">
                    <span>{source(lead)}</span>
                    <small>
                      Gửi {timeAgo(lead.createdAt)}
                      {lead.handledAt && ` · đã liên hệ ${timeAgo(lead.handledAt)}`}
                    </small>
                  </span>
                  <span className="eld-row__actions">
                    {lead.handledAt ? (
                      <span className="eld-row__done">
                        <IconCheck size={14} />
                        Đã liên hệ
                      </span>
                    ) : (
                      <button type="button" className="emp-btn emp-btn--sm" disabled={busyId === lead.id} onClick={() => void markHandled(lead)}>
                        <IconCheck size={14} />
                        {busyId === lead.id ? 'Đang lưu…' : 'Đã liên hệ'}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <Pager page={data.page} perPage={data.limit} total={data.total} shown={data.items.length} noun="khách" onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
