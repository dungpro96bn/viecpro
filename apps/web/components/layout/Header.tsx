import Link from 'next/link';
import { cx } from '@/lib/format';
import HeaderShell from './HeaderShell';
import Logo from './Logo';
import MobileMenu from './MobileMenu';
import './layout.css';

export type NavKey = 'jobs' | 'programs' | 'guide' | 'consult' | 'employers';

const NAV: Array<{ key: NavKey; label: string; href: string }> = [
  { key: 'jobs', label: 'Việc làm', href: '/tim-kiem' },
  { key: 'programs', label: 'Chương trình', href: '#' },
  { key: 'guide', label: 'Cẩm nang', href: '#' },
  { key: 'consult', label: 'Tư vấn', href: '#' },
  { key: 'employers', label: 'Nhà tuyển dụng', href: '/nha-tuyen-dung/viet-nam-camcom' },
];

export default function Header({ active = 'jobs' }: { active?: NavKey }) {
  return (
    <HeaderShell>
      <div className="container site-header__inner">
        <div className="site-header__left">
          <Logo />
          <nav className="site-nav" aria-label="Điều hướng chính">
            {NAV.map((item) => (
              <Link key={item.key} href={item.href} className={cx('site-nav__link', item.key === active && 'site-nav__link--active')}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="site-header__actions">
          <Link href="/dang-nhap" className="btn btn--pill site-header__login">
            Đăng nhập
          </Link>
          <Link href="/quan-ly-tuyen-dung/don-hang/dang-tin" className="btn btn--primary btn--pill site-header__post">
            Đăng tin tuyển dụng
          </Link>
          <MobileMenu nav={NAV} active={active} />
        </div>
      </div>
    </HeaderShell>
  );
}
