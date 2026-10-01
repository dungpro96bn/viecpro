'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';

interface SectionTabsProps {
  label: string;
  items: Array<{ id: string; label: string; count?: number }>;
  actions?: ReactNode;
  className?: string;
}

/** Thanh mục lục dính đầu trang, tự đánh dấu mục đang xem khi cuộn */
export default function SectionTabs({ label, items, actions, className }: SectionTabsProps) {
  const [active, setActive] = useState(items[0]?.id);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  // Thanh tab cuộn ngang (tablet / mobile): giữ tab đang xem ở giữa tầm nhìn
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('.sticky-tabs__link--active');
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    const left = link.offsetLeft - nav.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: 'smooth' });
  }, [active]);

  return (
    <div className={cx('sticky-tabs', className)}>
      <div className="container sticky-tabs__inner">
        <nav ref={navRef} className="sticky-tabs__nav" aria-label={label}>
          {items.map((item) => (
            <a key={item.id} href={`#${item.id}`} className={cx('sticky-tabs__link', active === item.id && 'sticky-tabs__link--active')}>
              {item.label}
              {item.count !== undefined && <span className="sticky-tabs__count">{item.count}</span>}
            </a>
          ))}
        </nav>
        {actions && <div className="sticky-tabs__actions">{actions}</div>}
      </div>
    </div>
  );
}
