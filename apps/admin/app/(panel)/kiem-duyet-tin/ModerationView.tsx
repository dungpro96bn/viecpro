'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { JOB_REMOVAL_LABEL, type ModerationFilter, type ModerationItem, type ModerationList, type ModerationTab } from '@viecpro/shared';
import Pagination from '@/components/list/Pagination';
import { errorText, relativeTime } from '@/components/list/list-utils';
import { useDebounced } from '@/components/list/useDebounced';
import { useShell } from '@/components/layout/AdminShell';
import { IconArrowRight, IconCheck, IconList, IconModeration, IconScanCheck, IconSearch } from '@/components/ui/Icons';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cx, formatNumber, formatSla } from '@/lib/format';
import DecisionDialog, { type Decision } from './DecisionDialog';
import ModerationDrawer from './ModerationDrawer';
import { riskLevel } from './moderation-utils';

const PAGE_SIZE = 20;
/** Hoàn tác trong 10 giây (spec A-02) – thao tác chỉ gửi API sau khoảng này */
const UNDO_MS = 10_000;
/** Tin rủi ro thấp được duyệt nhanh ngay trên danh sách */
const QUICK_APPROVE_BELOW = 30;

const TABS: Array<{ key: ModerationTab; label: string }> = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'changes', label: 'Yêu cầu sửa' },
  { key: 'done', label: 'Đã xử lý' },
];
const FILTERS: Array<{ key: ModerationFilter; label: string }> = [
  { key: 'high_risk', label: 'Rủi ro cao' },
  { key: 'reported', label: 'Bị báo cáo' },
  { key: 'new_employer', label: 'DN mới' },
  { key: 'sla', label: 'Sắp quá SLA' },
];


type ActionKind = 'approve' | Decision;
interface PendingAction {
  item: ModerationItem;
  kind: ActionKind;
  reason?: string;
  timer: number;
}
const DONE_TEXT: Record<ActionKind, string> = { approve: 'Đã duyệt', reject: 'Đã từ chối', 'request-changes': 'Đã yêu cầu sửa' };

/** Kiểm duyệt tin (design-new 07 – A-02) */
export default function ModerationView() {
  const { can } = useAuth();
  const canModerate = can('jobs.moderate');
  const { refreshBadges } = useShell();
  const [tab, setTab] = useState<ModerationTab>('pending');
  const [filter, setFilter] = useState<ModerationFilter | null>(null);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ModerationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ item: ModerationItem; kind: Decision } | null>(null);
  const [undo, setUndo] = useState<PendingAction | null>(null);
  const undoRef = useRef<PendingAction | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ tab, page: String(page), limit: String(PAGE_SIZE) });
      if (q) p.set('q', q);
      if (filter && tab === 'pending') p.set('filter', filter);
      setData(await api<ModerationList>(`/admin/jobs/pending?${p.toString()}`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [tab, page, q, filter]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => setPage(1), [q]);

  /** Gửi thao tác đang chờ hoàn tác lên API */
  const commit = useCallback(
    async (action: PendingAction) => {
      window.clearTimeout(action.timer);
      if (undoRef.current === action) {
        undoRef.current = null;
        setUndo(null);
      }
      try {
        if (action.kind === 'approve') await post(`/admin/jobs/${action.item.id}/approve`);
        else await post(`/admin/jobs/${action.item.id}/${action.kind}`, { reason: action.reason });
      } catch (e) {
        setError(`Không lưu được quyết định cho “${action.item.title}”: ${errorText(e)}`);
      }
      await Promise.all([load(), refreshBadges()]);
    },
    [load, refreshBadges],
  );

  // Rời trang khi còn thao tác chờ → gửi luôn, không mất quyết định (chỉ chạy khi unmount)
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(
    () => () => {
      if (undoRef.current) void commitRef.current(undoRef.current);
    },
    [],
  );

  const act = (item: ModerationItem, kind: ActionKind, reason?: string) => {
    if (undoRef.current) void commit(undoRef.current);
    const action: PendingAction = { item, kind, reason, timer: 0 };
    action.timer = window.setTimeout(() => void commit(action), UNDO_MS);
    undoRef.current = action;
    setUndo(action);
    setOpenId(null);
    setDeciding(null);
  };
  const cancelUndo = () => {
    if (!undoRef.current) return;
    window.clearTimeout(undoRef.current.timer);
    undoRef.current = null;
    setUndo(null);
  };

  // Tin đang chờ hoàn tác ẩn khỏi danh sách
  const items = (data?.items ?? []).filter((i) => i.id !== undo?.item.id);
  const selected = items[Math.min(cursor, items.length - 1)];

  // Phím tắt: J / K chọn tin · Enter mở · A duyệt · R từ chối (spec A-02)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable], dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        e.preventDefault();
        setCursor((c) => Math.max(0, Math.min(items.length - 1, c + (key === 'j' ? 1 : -1))));
      } else if (key === 'enter' && selected) {
        setOpenId(selected.id);
      } else if (key === 'a' && selected && canModerate && tab === 'pending') {
        act(selected, 'approve');
      } else if (key === 'r' && selected && canModerate && tab === 'pending') {
        setDeciding({ item: selected, kind: 'reject' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    listRef.current?.querySelector('.mod-row--cursor')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const switchTab = (t: ModerationTab) => {
    setTab(t);
    setPage(1);
    setCursor(0);
  };
  const s = data?.stats;

  return (
    <>
      <header className="page-header page-header--list">
        <span className="page-header__titles">
          <span className="page-header__meta">
            <Link href="/">Bảng điều khiển</Link> / Vận hành
          </span>
          <h1 className="page-header__title">Kiểm duyệt tin</h1>
        </span>
        <div className="page-header__actions">
          <label className="list-search">
            <IconSearch size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tin, doanh nghiệp, mã tin…" aria-label="Tìm tin cần kiểm duyệt" />
          </label>
          {/* Spec R9: không dùng chữ "AI" – hệ thống chấm điểm bằng quy tắc, chưa tự duyệt */}
          <span className="mod-auto" title="Mọi tin được kiểm tra tự động: SĐT / link, từ khoá phí, lương bất thường, trùng tin, doanh nghiệp">
            <IconScanCheck size={16} />
            Kiểm tra tự động: Bật
          </span>
        </div>
      </header>

      <div className="page-body">
        <div className="mod-stats">
          <span className="mod-stat">
            <i className="mod-stat__dot mod-stat__dot--blue" />
            <b>{s ? formatNumber(s.pending) : '—'}</b>
            <span>chờ duyệt</span>
          </span>
          <span className="mod-stat">
            <i className="mod-stat__dot mod-stat__dot--red" />
            <b>{s ? formatNumber(s.nearSla) : '—'}</b>
            <span>sắp quá SLA</span>
          </span>
          <span className="mod-stat">
            <i className="mod-stat__dot mod-stat__dot--green" />
            <b>{s ? formatNumber(s.processedToday) : '—'}</b>
            <span>đã xử lý hôm nay</span>
          </span>
          <Link href="/nhat-ky" className="mod-log">
            <IconList size={15} />
            Nhật ký kiểm duyệt
          </Link>
        </div>

        {error && (
          <p className="alert alert--danger" role="alert">
            {error}
          </p>
        )}

        <section className="list-card" aria-label="Tin cần kiểm duyệt">
          <div className="mod-toolbar">
            <span className="mod-tabs" role="tablist" aria-label="Trạng thái">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx('mod-tabs__item', tab === t.key && 'mod-tabs__item--on')} onClick={() => switchTab(t.key)}>
                  {t.label}
                  <span className="mod-tabs__count">{data ? formatNumber(data.tabs[t.key]) : '…'}</span>
                </button>
              ))}
            </span>
            {tab === 'pending' && (
              <span className="mod-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={filter === f.key}
                    className={cx('chip-toggle mod-chip', filter === f.key && 'chip-toggle--on')}
                    onClick={() => {
                      setFilter((cur) => (cur === f.key ? null : f.key));
                      setPage(1);
                      setCursor(0);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </span>
            )}
            <span className="mod-toolbar__meta">
              {data ? `${formatNumber(data.total)} tin` : '…'} · {tab === 'pending' ? 'sắp xếp theo hạn SLA' : tab === 'changes' ? 'mới yêu cầu trước' : '7 ngày gần nhất'}
            </span>
          </div>

          <div className="mod-list" ref={listRef} role="list">
            {loading && !data
              ? Array.from({ length: 6 }, (_, i) => <span key={i} className="skeleton mod-skeleton" />)
              : items.map((item, i) => (
                  <Row
                    key={item.id}
                    item={item}
                    tab={tab}
                    cursor={i === cursor}
                    canApprove={canModerate && tab === 'pending' && item.risk < QUICK_APPROVE_BELOW}
                    onFocus={() => setCursor(i)}
                    onApprove={() => act(item, 'approve')}
                    onOpen={() => {
                      setCursor(i);
                      setOpenId(item.id);
                    }}
                  />
                ))}
            {data && !items.length && (
              <div className="list-empty">
                <IconModeration size={26} />
                <b>{tab === 'pending' ? (filter || q ? 'Không có tin phù hợp bộ lọc' : 'Hàng chờ đã trống') : 'Chưa có tin nào'}</b>
                {tab === 'pending' && !filter && !q ? 'Tin mới gửi duyệt sẽ hiện ở đây, sắp theo hạn SLA 2 giờ.' : 'Thử bỏ bộ lọc hoặc đổi từ khoá.'}
              </div>
            )}
          </div>
          {data && <Pagination page={data.page} limit={data.limit} total={data.total} unit="tin" onPage={setPage} />}
          {tab === 'pending' && canModerate && (
            <p className="mod-keys" aria-hidden="true">
              Phím tắt: <kbd>J</kbd>/<kbd>K</kbd> chọn tin · <kbd>Enter</kbd> xem chi tiết · <kbd>A</kbd> duyệt · <kbd>R</kbd> từ chối
            </p>
          )}
        </section>
      </div>

      <ModerationDrawer
        id={openId}
        canModerate={canModerate}
        onClose={() => setOpenId(null)}
        onApprove={(item) => act(item, 'approve')}
        onDecide={(item, kind) => setDeciding({ item, kind })}
      />

      <DecisionDialog open={deciding?.kind ?? null} jobTitle={deciding?.item.title ?? ''} onConfirm={(reason) => deciding && act(deciding.item, deciding.kind, reason)} onClose={() => setDeciding(null)} />

      {undo && (
        <div className="mod-undo" role="status">
          <IconCheck size={16} />
          <span>
            {DONE_TEXT[undo.kind]} “{undo.item.title}”
          </span>
          <button type="button" onClick={cancelUndo}>
            Hoàn tác
          </button>
          <i className="mod-undo__bar" />
        </div>
      )}
    </>
  );
}

function Row({ item, tab, cursor, canApprove, onFocus, onApprove, onOpen }: { item: ModerationItem; tab: ModerationTab; cursor: boolean; canApprove: boolean; onFocus: () => void; onApprove: () => void; onOpen: () => void }) {
  const level = riskLevel(item.risk);
  const urgent = item.slaMinutes <= 20;
  return (
    <div role="listitem" className={cx('mod-row', level === 'high' && tab === 'pending' && 'mod-row--high', cursor && 'mod-row--cursor')} onMouseEnter={onFocus}>
      <img className="mod-row__img" src={item.imageUrl} alt="" width={48} height={48} />
      <span className="mod-row__main">
        <button type="button" className="mod-row__title" onClick={onOpen}>
          {item.title}
        </button>
        <span className="mod-row__sub">
          {item.employerName} · {item.code}
        </span>
      </span>
      <span className="mod-row__risk">
        <span className={cx('mod-score', `mod-score--${level}`)}>{item.risk}</span>
        <span className="mod-row__flag">{item.flag ?? 'Không phát hiện vấn đề'}</span>
      </span>
      {tab === 'pending' ? (
        <span className={cx('mod-row__sla', (urgent || item.slaMinutes < 0) && 'mod-row__sla--urgent')}>{formatSla(item.slaMinutes)}</span>
      ) : (
        <span className="mod-row__result">
          <span className={cx('mod-result', item.status === 'open' ? 'mod-result--ok' : item.changesRequested ? 'mod-result--warn' : item.status === 'rejected' ? 'mod-result--bad' : 'mod-result--muted')}>
            {item.changesRequested ? 'Yêu cầu sửa' : item.status === 'open' ? 'Đã duyệt' : item.status === 'rejected' ? 'Từ chối' : 'Đã đóng'}
          </span>
          {item.removedByOwner && <span className="mod-result mod-result--muted">{JOB_REMOVAL_LABEL[item.removedByOwner]}</span>}
          <small>{[item.moderatorName, item.moderatedAt && relativeTime(item.moderatedAt)].filter(Boolean).join(' · ')}</small>
        </span>
      )}
      <span className="mod-row__actions">
        {canApprove && (
          <button type="button" className="mod-approve" onClick={onApprove}>
            <IconCheck size={14} />
            Duyệt
          </button>
        )}
        <button type="button" className="row-btn" onClick={onOpen}>
          Xem chi tiết
          <IconArrowRight size={13} />
        </button>
      </span>
    </div>
  );
}
