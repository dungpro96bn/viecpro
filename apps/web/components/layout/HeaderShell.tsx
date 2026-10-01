'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';

/** Khung header dính đầu trang, thêm đổ bóng khi trang đã cuộn */
export default function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <header className={cx('site-header', scrolled && 'site-header--scrolled')}>{children}</header>;
}
