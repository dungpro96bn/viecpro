'use client';

import type { ModerationItem, Paginated } from '@viecpro/shared';
import { PROGRAM_LABEL } from '@viecpro/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Dialog from '@/components/ui/Dialog';
import { useShell } from '@/components/layout/AdminShell';
import { IconAlert, IconArrowRight, IconCheck, IconClock, IconModeration, IconRefresh, IconSearch, IconShieldCheck, IconSparkle } from '@/components/ui/Icons';
import { ApiRequestError, api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, formatSla } from '@/lib/format';

type RiskFilter = 'all' | 'high' | 'medium' | 'low';
const PAGE_SIZE = 10;

const errorText = (error: unknown) => (error instanceof ApiRequestError ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.');
const riskLevel = (score: number): Exclude<RiskFilter, 'all'> => (score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low');
const dateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));

const FILTERS: Array<{ key: RiskFilter; label: string }> = [
  { key: 'all', label: 'Tất cả mức độ' },
  { key: 'high', label: 'Rủi ro cao' },
  { key: 'medium', label: 'Cần lưu ý' },
  { key: 'low', label: 'Rủi ro thấp' },
];

export default function ModerationView() {
  const { can } = useAuth();
  const canModerate = can('jobs.moderate');
  const { refreshBadges } = useShell();
  const [data, setData] = useState<Paginated<ModerationItem> | null>(null);
  const [selected, setSelected] = useState<ModerationItem | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ModerationItem | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (targetPage: number, term: string, quiet = false) => {
    const id = ++requestId.current;
    setError(null);
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
      if (term) params.set('q', term);
      const result = await api<Paginated<ModerationItem>>(`/admin/jobs/pending?${params.toString()}`);
      if (id !== requestId.current) return;
      setData(result);
      setSelected((current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null);
    } catch (e) {
      if (id === requestId.current) setError(errorText(e));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(page, query);
  }, [load, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    return riskFilter === 'all' ? data.items : data.items.filter((item) => riskLevel(item.risk) === riskFilter);
  }, [data, riskFilter]);

  const pageStats = useMemo(() => {
    const items = data?.items ?? [];
    return {
      high: items.filter((item) => riskLevel(item.risk) === 'high').length,
      urgent: items.filter((item) => item.slaMinutes <= 20).length,
      averageRisk: items.length ? Math.round(items.reduce((sum, item) => sum + item.risk, 0) / items.length) : 0,
    };
  }, [data]);

  const refresh = () => void load(page, query, true);

  const reloadAfterDecision = async () => {
    await refreshBadges();
    if (data && page > 1 && data.items.length === 1) setPage((current) => Math.max(1, current - 1));
    else await load(page, query, true);
  };

  const approve = async (item: ModerationItem) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await post(`/admin/jobs/${item.id}/approve`);
      setSuccess(`Đã duyệt “${item.title}”. Tin đã được đưa vào danh sách công khai.`);
      setSelected(null);
      await reloadAfterDecision();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    if (!rejecting) return;
    const item = rejecting;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await post(`/admin/jobs/${item.id}/reject`, { reason });
      setRejecting(null);
      setSuccess(`Đã từ chối “${item.title}”. Lý do đã được gửi cho nhà tuyển dụng.`);
      setSelected(null);
      await reloadAfterDecision();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <>
      <header className="page-header">
        <span className="page-header__titles">
          <span className="page-header__meta">Vận hành · Quy trình duyệt nội dung</span>
          <h1 className="page-header__title">Kiểm duyệt tin</h1>
        </span>
        <div className="page-header__actions moderation-head-actions">
          <span className="moderation-live"><i />Hàng chờ trực tiếp</span>
          <button type="button" className="btn btn--outline moderation-refresh" onClick={refresh} disabled={loading || refreshing}>
            {refreshing ? <span className="spinner" /> : <IconRefresh size={16} />}
            Làm mới
          </button>
        </div>
      </header>

      <div className="page-body moderation-page">
        <section className="moderation-intro">
          <div className="moderation-intro__copy">
            <span className="moderation-intro__eyebrow"><IconSparkle size={15} />TRUNG TÂM KIỂM SOÁT CHẤT LƯỢNG</span>
            <h2>Duyệt đúng tin, giữ vững niềm tin</h2>
            <p>Ưu tiên các tin có tín hiệu rủi ro và sắp chạm hạn xử lý. Điểm cảnh báo được tính theo quy tắc rõ ràng để bạn dễ kiểm tra.</p>
          </div>
          <div className="moderation-intro__art" aria-hidden="true">
            <span className="moderation-intro__orbit moderation-intro__orbit--outer" />
            <span className="moderation-intro__orbit moderation-intro__orbit--inner" />
            <span className="moderation-intro__shield"><IconShieldCheck size={42} /></span>
            <span className="moderation-intro__spark moderation-intro__spark--one" />
            <span className="moderation-intro__spark moderation-intro__spark--two" />
          </div>
          <span className="moderation-intro__glow" />
        </section>

        {error && <p className="alert alert--danger" role="alert">{error} <button type="button" className="moderation-inline-link" onClick={refresh}>Thử lại</button></p>}
        {success && <p className="moderation-success" role="status"><IconCheck size={16} />{success}<button type="button" aria-label="Đóng thông báo" onClick={() => setSuccess(null)}>×</button></p>}

        <section className="moderation-kpis" aria-label="Tình hình hàng chờ">
          <article className="moderation-kpi moderation-kpi--total">
            <span className="moderation-kpi__top"><span className="moderation-kpi__icon"><IconModeration size={18} /></span><span className="moderation-kpi__hint">Cần xử lý</span></span>
            <b className="moderation-kpi__value">{loading && !data ? '—' : formatNumber(data?.total ?? 0)}</b>
            <span className="moderation-kpi__label">Tin đang chờ duyệt</span>
          </article>
          <article className="moderation-kpi moderation-kpi--risk">
            <span className="moderation-kpi__top"><span className="moderation-kpi__icon"><IconAlert size={18} /></span><span className="moderation-kpi__hint">Trang này</span></span>
            <b className="moderation-kpi__value">{loading && !data ? '—' : pageStats.high}</b>
            <span className="moderation-kpi__label">Tin có rủi ro cao</span>
          </article>
          <article className="moderation-kpi moderation-kpi--sla">
            <span className="moderation-kpi__top"><span className="moderation-kpi__icon"><IconClock size={18} /></span><span className="moderation-kpi__hint">Trang này</span></span>
            <b className="moderation-kpi__value">{loading && !data ? '—' : pageStats.urgent}</b>
            <span className="moderation-kpi__label">Tin còn ≤ 20 phút SLA</span>
          </article>
          <article className="moderation-kpi moderation-kpi--average">
            <span className="moderation-kpi__top"><span className="moderation-kpi__icon"><IconSparkle size={18} /></span><span className="moderation-kpi__hint">Thang 100</span></span>
            <b className="moderation-kpi__value">{loading && !data ? '—' : pageStats.averageRisk}</b>
            <span className="moderation-kpi__label">Rủi ro trung bình trên trang</span>
          </article>
        </section>

        <div className="moderation-workspace">
          <section className="moderation-queue panel panel--flush" aria-labelledby="moderation-queue-title">
            <div className="moderation-queue__head">
              <div>
                <span className="moderation-queue__eyebrow">HÀNG CHỜ KIỂM DUYỆT</span>
                <h2 id="moderation-queue-title">Tin cần được xem xét</h2>
                <p>Sắp xếp theo thời điểm gửi để tin gần hạn được ưu tiên.</p>
              </div>
              <span className="moderation-queue__count"><b>{data ? formatNumber(data.total) : '—'}</b><span>đang chờ</span></span>
            </div>

            <form className="moderation-tools" role="search" onSubmit={submitSearch}>
              <div className="moderation-search">
                <IconSearch size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tiêu đề tin hoặc nhà tuyển dụng" aria-label="Tìm tiêu đề tin hoặc nhà tuyển dụng" />
                {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearch('')}>×</button>}
              </div>
              <div className="moderation-filters" role="group" aria-label="Lọc theo mức rủi ro">
                {FILTERS.map((filter) => (
                  <button key={filter.key} type="button" className={cx('moderation-filter', riskFilter === filter.key && 'moderation-filter--active', filter.key !== 'all' && `moderation-filter--${filter.key}`)} aria-pressed={riskFilter === filter.key} onClick={() => setRiskFilter(filter.key)}>
                    {filter.label}
                  </button>
                ))}
              </div>
            </form>

            {loading && !data ? (
              <div className="moderation-skeleton" aria-busy="true" aria-label="Đang tải hàng chờ">
                {Array.from({ length: 5 }, (_, index) => <span key={index} className="skeleton moderation-skeleton__row" />)}
              </div>
            ) : data?.items.length === 0 ? (
              <div className="moderation-empty">
                <span><IconCheck size={23} /></span>
                <b>{query ? 'Không tìm thấy tin phù hợp' : 'Hàng chờ đã thông thoáng'}</b>
                <p>{query ? 'Thử từ khóa ngắn hơn hoặc xóa tìm kiếm để xem lại toàn bộ hàng chờ.' : 'Hiện không có tin nào cần kiểm duyệt. Hệ thống sẽ cập nhật khi có tin mới.'}</p>
                {query && <button type="button" className="btn btn--outline" onClick={() => { setSearch(''); setQuery(''); }}>Xóa tìm kiếm</button>}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="moderation-empty moderation-empty--compact">
                <b>Không có tin thuộc mức rủi ro này trong trang hiện tại</b>
                <p>Thử một mức rủi ro khác hoặc chuyển sang trang kế tiếp.</p>
              </div>
            ) : (
              <div className="moderation-list" role="list" aria-label="Danh sách tin chờ duyệt">
                <div className="moderation-list__labels" aria-hidden="true"><span>TIN TUYỂN DỤNG</span><span>RỦI RO</span><span>HẠN XỬ LÝ</span></div>
                {filteredItems.map((item) => <ModerationRow key={item.id} item={item} selected={selected?.id === item.id} onSelect={() => setSelected(item)} />)}
              </div>
            )}

            <footer className="moderation-pagination">
              <span>{data ? <>{data.total === 0 ? 'Chưa có tin' : `Trang ${data.page} · ${formatNumber(data.total)} tin`}</> : 'Đang tải dữ liệu'}</span>
              <div>
                <button type="button" className="btn btn--outline btn--sm" disabled={!data || data.page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</button>
                <button type="button" className="btn btn--outline btn--sm" disabled={!data?.hasMore || loading} onClick={() => setPage((current) => current + 1)}>Tiếp<IconArrowRight size={13} /></button>
              </div>
            </footer>
          </section>

          <aside className="moderation-inspector" aria-label="Chi tiết tin đang chọn">
            {selected ? (
              <ModerationInspector item={selected} canModerate={canModerate} busy={busy} onApprove={() => void approve(selected)} onReject={() => setRejecting(selected)} />
            ) : (
              <div className="moderation-inspector__blank">
                <span><IconModeration size={24} /></span>
                <b>{data?.total ? 'Chọn một tin để xem chi tiết' : 'Chưa có tin để xem'}</b>
                <p>Thông tin doanh nghiệp, tín hiệu rủi ro và thao tác kiểm duyệt sẽ hiện tại đây.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Dialog
        open={!!rejecting}
        title="Từ chối tin tuyển dụng"
        description={rejecting ? `Lý do sẽ được gửi cho nhà tuyển dụng của tin “${rejecting.title}”. Hãy nêu rõ nội dung cần chỉnh sửa.` : undefined}
        input={{ label: 'Lý do từ chối', placeholder: 'Ví dụ: Thông tin mức lương chưa rõ, vui lòng bổ sung…', required: true, minLength: 5 }}
        confirmLabel="Từ chối tin"
        tone="danger"
        busy={busy}
        error={rejecting ? error : null}
        onConfirm={(reason) => void reject(reason)}
        onClose={() => { setRejecting(null); setError(null); }}
      />
    </>
  );
}

function ModerationRow({ item, selected, onSelect }: { item: ModerationItem; selected: boolean; onSelect: () => void }) {
  const level = riskLevel(item.risk);
  const slaUrgent = item.slaMinutes <= 20;
  return (
    <article className={cx('moderation-item', selected && 'moderation-item--selected', level === 'high' && 'moderation-item--high')} role="listitem">
      <button type="button" className="moderation-item__select" aria-pressed={selected} onClick={onSelect}>
        <span className="moderation-item__thumb"><img src={item.imageUrl} alt="" width={58} height={58} /><span className="moderation-item__thumb-mark"><IconModeration size={13} /></span></span>
        <span className="moderation-item__main">
          <b className="moderation-item__title">{item.title}</b>
          <span className="moderation-item__employer">{item.employerName}{item.employerVerified && <IconShieldCheck size={13} className="moderation-item__verified" />}</span>
          <span className="moderation-item__meta"><span>{item.industry}</span><i />{PROGRAM_LABEL[item.program]}<i />{formatNumber(item.salary)} ¥/tháng</span>
        </span>
        <span className="moderation-risk">
          <span className={cx('moderation-risk__pill', `moderation-risk__pill--${level}`)}>{item.risk}<small>/100</small></span>
          <span className="moderation-risk__track"><i className={`moderation-risk__bar moderation-risk__bar--${level}`} style={{ width: `${item.risk}%` }} /></span>
          <span className="moderation-risk__reason">{item.flag ?? 'Chưa có cảnh báo'}</span>
        </span>
        <span className={cx('moderation-sla', slaUrgent && 'moderation-sla--urgent', item.slaMinutes < 0 && 'moderation-sla--late')}>
          <IconClock size={14} />
          <b>{formatSla(item.slaMinutes)}</b>
          <small>từ {dateTime(item.submittedAt)}</small>
        </span>
        <IconArrowRight size={16} className="moderation-item__arrow" />
      </button>
    </article>
  );
}

function ModerationInspector({ item, canModerate, busy, onApprove, onReject }: { item: ModerationItem; canModerate: boolean; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const level = riskLevel(item.risk);
  return (
    <section className="moderation-inspector__card">
      <div className="moderation-inspector__topline"><span>HỒ SƠ KIỂM DUYỆT</span><span className={cx('moderation-inspector__level', `moderation-inspector__level--${level}`)}>{level === 'high' ? 'Ưu tiên cao' : level === 'medium' ? 'Cần xem kỹ' : 'Rủi ro thấp'}</span></div>
      <div className="moderation-inspector__cover"><img src={item.imageUrl} alt="Ảnh minh họa tin tuyển dụng" /><span className="moderation-inspector__cover-shade" /><span className="moderation-inspector__score"><IconSparkle size={14} />{item.risk}<small>/100</small></span></div>
      <div className="moderation-inspector__body">
        <h2>{item.title}</h2>
        <div className="moderation-inspector__company"><span className="moderation-inspector__company-icon">{item.employerName.trim().slice(0, 1).toUpperCase()}</span><span><b>{item.employerName}</b><small>{item.employerVerified ? 'Nhà tuyển dụng đã xác minh' : 'Nhà tuyển dụng chưa xác minh'}</small></span>{item.employerVerified && <IconShieldCheck size={17} />}</div>

        <div className="moderation-facts">
          <span><small>Chương trình</small><b>{PROGRAM_LABEL[item.program]}</b></span>
          <span><small>Ngành nghề</small><b>{item.industry}</b></span>
          <span><small>Mức lương</small><b>{formatNumber(item.salary)} ¥/tháng</b></span>
          <span><small>Đã gửi lúc</small><b>{dateTime(item.submittedAt)}</b></span>
        </div>

        <div className="moderation-inspector__risk">
          <div><b>Tín hiệu cần rà soát</b><span>{item.reportCount ? `${item.reportCount} báo cáo liên quan` : 'Đánh giá tự động'}</span></div>
          <ul>
            {item.reasons.length ? item.reasons.map((reason) => <li key={reason} className={reason === item.flag ? 'moderation-reason moderation-reason--primary' : 'moderation-reason'}><IconAlert size={14} />{reason}</li>) : <li className="moderation-reason moderation-reason--clear"><IconCheck size={14} />Chưa phát hiện dấu hiệu bất thường</li>}
          </ul>
          <p>Điểm được tính từ báo cáo vi phạm, mức lương, tin trùng và trạng thái doanh nghiệp; đây là tín hiệu hỗ trợ quyết định.</p>
        </div>

        <div className={cx('moderation-inspector__sla', item.slaMinutes <= 20 && 'moderation-inspector__sla--urgent')}>
          <IconClock size={17} /><span><b>{formatSla(item.slaMinutes)}</b><small>thời gian còn lại theo SLA 2 giờ</small></span>
        </div>

        {canModerate ? (
          <div className="moderation-inspector__actions">
            <button type="button" className="btn btn--danger-outline" onClick={onReject} disabled={busy}>Từ chối</button>
            <button type="button" className="btn btn--success" onClick={onApprove} disabled={busy}>{busy ? <span className="spinner" /> : <IconCheck size={16} className="icon--w24" />}Duyệt tin</button>
          </div>
        ) : (
          <p className="moderation-inspector__readonly">Tài khoản của bạn chỉ có quyền xem hàng chờ.</p>
        )}
      </div>
    </section>
  );
}
