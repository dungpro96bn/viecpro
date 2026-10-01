'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { NotificationItem, Paginated } from '@viecpro/shared';
import { IconBellLine } from '@/components/ui/Icons';
import { apiRequest } from '@/lib/api';
import { timeAgo } from '@/lib/employer';
import { cx } from '@/lib/format';
import './account.css';

type NotificationPage = Paginated<NotificationItem> & { unread: number };

/** Chuông thông báo + danh sách 6 thông báo mới (dùng ở khu NTD và tài khoản ứng viên) */
export default function NotificationMenu({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationPage | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void apiRequest<NotificationPage>('/me/notifications?page=1&limit=6').then(setData).catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const markRead = (id?: string) => {
    if (!data) return;
    const now = new Date().toISOString();
    setData({
      ...data,
      unread: id ? Math.max(0, data.unread - (data.items.some((n) => n.id === id && !n.readAt) ? 1 : 0)) : 0,
      items: data.items.map((n) => (!id || n.id === id ? { ...n, readAt: n.readAt ?? now } : n)),
    });
    void apiRequest<void>(id ? `/me/notifications/${encodeURIComponent(id)}/read` : '/me/notifications/read-all', { method: 'POST' }).catch(() => undefined);
  };

  const unread = data?.unread ?? 0;
  return (
    <div className="notif-menu" ref={ref}>
      <button
        type="button"
        className={cx('notif-menu__trigger', `notif-menu__trigger--${tone}`)}
        aria-label={unread ? `Thông báo (${unread} chưa đọc)` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <IconBellLine size={20} />
        {unread > 0 && <span className={cx('notif-menu__dot', tone === 'light' && 'notif-menu__dot--count')}>{tone === 'light' ? unread : null}</span>}
      </button>
      {open && (
        <div className="notif-menu__panel" role="menu">
          <div className="notif-menu__head">
            <b>Thông báo</b>
            {unread > 0 && (
              <button type="button" className="notif-menu__read-all" onClick={() => markRead()}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          {data?.items.length ? (
            <ul className="notif-menu__list">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? '#'} className={cx('notif-menu__item', !n.readAt && 'notif-menu__item--unread')} onClick={() => { markRead(n.id); setOpen(false); }}>
                    <span className="notif-menu__title">{n.title}</span>
                    {n.body && <span className="notif-menu__body">{n.body}</span>}
                    <span className="notif-menu__time">{timeAgo(n.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notif-menu__empty">Chưa có thông báo nào.</p>
          )}
        </div>
      )}
    </div>
  );
}
