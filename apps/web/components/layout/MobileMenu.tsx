'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cx } from '@/lib/format';
import { IconArrowRight, IconClose, IconMenu } from '../ui/Icons';

interface MobileMenuProps {
  nav: Array<{ key: string; label: string; href: string }>;
  active?: string;
}

/** Menu điều hướng dạng tấm trượt cho tablet / mobile (chỉ hiện trên trang .page--fluid) */
export default function MobileMenu({ nav, active }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const mq = window.matchMedia('(min-width: 1201px)');
    const onResize = () => mq.matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onResize);
    document.documentElement.classList.add('is-menu-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onResize);
      document.documentElement.classList.remove('is-menu-open');
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="mobile-menu__toggle"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Đóng menu' : 'Mở menu'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <IconClose size={22} className="icon--w2" /> : <IconMenu size={22} className="icon--w2" />}
      </button>

      <div className={cx('mobile-menu', open && 'mobile-menu--open')} onClick={close} aria-hidden={!open}>
        <nav id="mobile-menu" className="mobile-menu__panel" aria-label="Điều hướng chính" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-menu__links">
            {nav.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                tabIndex={open ? undefined : -1}
                className={cx('mobile-menu__link', item.key === active && 'mobile-menu__link--active')}
                aria-current={item.key === active ? 'page' : undefined}
                onClick={close}
              >
                {item.label}
                <IconArrowRight size={16} className="icon--w2" />
              </Link>
            ))}
          </div>
          <div className="mobile-menu__actions">
            <Link href="/dang-nhap" tabIndex={open ? undefined : -1} className="btn btn--outline btn--lg btn--block" onClick={close}>
              Đăng nhập
            </Link>
            <Link href="#" tabIndex={open ? undefined : -1} className="btn btn--primary btn--lg btn--block btn--shadow" onClick={close}>
              Đăng tin tuyển dụng
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
