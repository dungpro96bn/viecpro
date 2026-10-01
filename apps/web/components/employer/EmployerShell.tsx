'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NotificationMenu from '@/components/account/NotificationMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  IconBarChart,
  IconBriefcaseLine,
  IconBuilding,
  IconCalendar,
  IconChatSquare,
  IconCheck,
  IconCheckMark,
  IconClose,
  IconExternal,
  IconHelp,
  IconHome,
  IconLogout,
  IconMembers,
  IconMenu,
  IconPhone,
  IconPlus,
  IconSearch,
  IconSettings,
  IconStarLine,
  IconTeam,
  IconUserRound,
} from '@/components/ui/Icons';
import { dayMonth, initialOf } from '@/lib/employer';
import { cx } from '@/lib/format';
import EmployerAccountProvider, { useEmployerAccount } from './EmployerAccountProvider';
import './employer.css';

export const EMPLOYER_BASE = '/quan-ly-tuyen-dung';

type NavItem = { href: string; label: string; icon: (p: { size?: number }) => ReactNode; count?: number; hot?: boolean; exact?: boolean };

/** Khung trang khu quản lý nhà tuyển dụng: thanh trên tối, menu trái, footer */
export default function EmployerShell({ children }: { children: ReactNode }) {
  return (
    <div className="emp-app page page--fluid">
      <EmployerAccountProvider fallback={<div className="emp-state" role="status">Đang tải khu quản lý…</div>}>
        <ShellFrame>{children}</ShellFrame>
      </EmployerAccountProvider>
    </div>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Đổi trang thì đóng menu trượt (tablet / mobile)
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <Topbar onMenu={() => setMenuOpen(true)} />
      <div className="emp-body">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="emp-main" id="emp-main">
          {children}
        </main>
      </div>
      <Footer />
    </>
  );
}

/* ---------- Thanh trên ---------- */
function Topbar({ onMenu }: { onMenu: () => void }) {
  const { account } = useEmployerAccount();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl / ⌘ + K: tìm ứng viên
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const company = account.company;
  return (
    <header className="emp-topbar">
      <button type="button" className="emp-topbar__menu" aria-label="Mở menu" onClick={onMenu}>
        <IconMenu size={20} />
      </button>
      <Link href={EMPLOYER_BASE} className="emp-brand" aria-label="viecpro Business – Tổng quan">
        <span className="emp-brand__mark">
          <IconCheckMark size={19} className="icon--w26" />
        </span>
        <span className="emp-brand__name">
          Viec<span>Pro</span>
        </span>
        <span className="emp-brand__tag">BUSINESS</span>
      </Link>
      <span className="emp-topbar__sep" aria-hidden="true" />

      {company ? (
        <div className="emp-org">
          {company.logoUrl ? <img className="emp-org__logo" src={company.logoUrl} alt="" /> : <span className="emp-org__logo emp-org__logo--text">{initialOf(company.name)}</span>}
          <span className="emp-org__text">
            <span className="emp-org__name">{company.shortName ?? company.name}</span>
            <span className="emp-org__meta">
              {account.plan?.name ?? 'Gói miễn phí'} · {company.memberCount} thành viên
            </span>
          </span>
        </div>
      ) : (
        <span className="emp-personal">
          <span className={cx('emp-personal__check', !account.cccdVerified && 'emp-personal__check--pending')}>
            <IconCheck size={12} className="icon--w3" />
          </span>
          <b>Tài khoản cá nhân</b>
          <span className="emp-personal__meta">· {account.cccdVerified ? 'Đã xác minh CCCD' : 'Chưa xác minh CCCD'}</span>
        </span>
      )}

      <form
        role="search"
        className="emp-search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchRef.current?.value.trim();
          router.push(`${EMPLOYER_BASE}/ung-vien${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        }}
      >
        <IconSearch size={17} />
        <input ref={searchRef} type="search" className="emp-search__input" placeholder="Tìm ứng viên, số điện thoại, mã đơn…" aria-label="Tìm ứng viên" />
        <kbd className="emp-search__kbd">Ctrl K</kbd>
      </form>

      <div className="emp-topbar__actions">
        <Link href={`${EMPLOYER_BASE}/don-hang/dang-tin`} className="emp-topbar__post">
          <IconPlus size={17} className="icon--w22" />
          <span>Đăng tin mới</span>
        </Link>
        <a href="#" className="emp-topbar__icon" aria-label="Trợ giúp">
          <IconHelp size={20} />
        </a>
        <NotificationMenu tone="dark" />
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { account } = useEmployerAccount();
  const { signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="emp-user" ref={ref}>
      <button type="button" className="emp-user__trigger" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        {account.user.avatarUrl ? <img className="emp-user__avatar" src={account.user.avatarUrl} alt="" /> : <span className="emp-user__avatar emp-user__avatar--text">{initialOf(account.user.name)}</span>}
        <span className="emp-user__text">
          <span className="emp-user__name">{account.user.name}</span>
          <span className="emp-user__role">{account.user.title}</span>
        </span>
      </button>
      {open && (
        <div className="emp-user__menu" role="menu">
          <Link href={publicHref(account)} className="emp-user__item" role="menuitem">
            <IconExternal size={16} />
            Xem trang public
          </Link>
          <button
            type="button"
            className="emp-user__item"
            role="menuitem"
            onClick={async () => {
              await signOut();
              router.replace('/dang-nhap');
            }}
          >
            <IconLogout size={16} />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Menu trái ---------- */
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account } = useEmployerAccount();
  const pathname = usePathname();
  const company = account.kind === 'company';

  const recruiting: NavItem[] = [
    { href: EMPLOYER_BASE, label: 'Tổng quan', icon: IconHome, exact: true },
    { href: `${EMPLOYER_BASE}/don-hang`, label: company ? 'Tin tuyển dụng' : 'Tin của tôi', icon: IconBriefcaseLine, count: account.counts.jobs },
    { href: `${EMPLOYER_BASE}/ung-vien`, label: 'Ứng viên', icon: IconTeam, count: account.counts.newApplicants, hot: true },
    { href: `${EMPLOYER_BASE}/lich-phong-van`, label: 'Lịch phỏng vấn', icon: IconCalendar, count: account.counts.upcomingInterviews },
    // Chưa có API: tin nhắn trong ứng dụng
    { href: '#', label: 'Tin nhắn', icon: IconChatSquare },
  ];
  const second: NavItem[] = company
    ? [
        { href: '#', label: 'Báo cáo', icon: IconBarChart },
        { href: publicHref(account), label: 'Trang công ty', icon: IconBuilding },
        { href: '#', label: 'Thành viên', icon: IconMembers },
        { href: '#', label: 'Cài đặt', icon: IconSettings },
      ]
    : [
        { href: `${EMPLOYER_BASE}#doanh-nghiep-phai-cu`, label: 'Đơn vị hợp tác', icon: IconBuilding, count: account.counts.partners },
        { href: publicHref(account), label: 'Hồ sơ cá nhân', icon: IconUserRound },
        { href: '#', label: 'Đánh giá', icon: IconStarLine, count: account.counts.reviews },
        { href: '#', label: 'Cài đặt', icon: IconSettings },
      ];

  const isActive = (item: NavItem) => item.href !== '#' && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Link key={item.label} href={item.href} className={cx('emp-nav__item', active && 'emp-nav__item--active')} aria-current={active ? 'page' : undefined}>
        <item.icon size={19} />
        <span className="emp-nav__label">{item.label}</span>
        {!!item.count && <span className={cx('emp-nav__count', item.hot && 'emp-nav__count--hot')}>{item.count}</span>}
      </Link>
    );
  };

  const plan = account.plan;
  return (
    <>
      <div className={cx('emp-sidebar__backdrop', open && 'emp-sidebar__backdrop--open')} onClick={onClose} aria-hidden="true" />
      <aside className={cx('emp-sidebar', open && 'emp-sidebar--open')} aria-label="Menu khu quản lý">
        <button type="button" className="emp-sidebar__close" aria-label="Đóng menu" onClick={onClose}>
          <IconClose size={18} />
        </button>
        <nav className="emp-nav" aria-label="Tuyển dụng">
          <span className="emp-nav__group">Tuyển dụng</span>
          {recruiting.map(renderItem)}
          <span className="emp-nav__group emp-nav__group--gap">{company ? 'Doanh nghiệp' : 'Cá nhân'}</span>
          {second.map(renderItem)}
        </nav>

        {plan && (
          <div className="emp-plan">
            <div className="emp-plan__head">
              <span className="emp-plan__name">{plan.name}</span>
              <span className="emp-plan__expiry">Hết hạn {dayMonth(plan.expiresAt, true)}</span>
            </div>
            <PlanMeter label="Tin đang hiển thị" used={plan.jobsVisible} total={plan.jobQuota} />
            <PlanMeter label="Lượt đẩy tin" used={plan.boostsUsed} total={plan.boostQuota} />
            {/* Chưa có API: thanh toán / nâng cấp gói */}
            <a href="#" className="emp-plan__upgrade">
              Nâng cấp gói
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

function PlanMeter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="emp-plan__meter">
      <span className="emp-plan__row">
        <span>{label}</span>
        <b>
          {used}/{total}
        </b>
      </span>
      <span className="emp-plan__track" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={total}>
        <span className="emp-plan__fill" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/* ---------- Footer ---------- */
const FOOTER_LINKS = ['Trung tâm trợ giúp', 'Hướng dẫn đăng tin', 'Bảo mật dữ liệu', 'Điều khoản'];

function Footer() {
  const { account } = useEmployerAccount();
  return (
    <footer className="emp-footer">
      <div className="emp-footer__left">
        <span className="emp-footer__status">
          <span className="emp-footer__dot" aria-hidden="true" />
          Hệ thống ổn định
        </span>
        <span className="emp-footer__copy">
          © 2026 viecpro Business<span aria-hidden="true"> · </span>v2.4
        </span>
      </div>
      <nav className="emp-footer__links" aria-label="Liên kết hỗ trợ">
        {FOOTER_LINKS.map((label) => (
          <a key={label} href="#">
            {label}
          </a>
        ))}
      </nav>
      <div className="emp-footer__right">
        <a href="tel:19006699" className="emp-footer__hotline">
          <IconPhone size={15} className="icon--w2" />
          Hỗ trợ DN: <b>1900 66 99</b>
        </a>
        <Link href={publicHref(account)} className="emp-footer__public">
          Trang public
          <IconExternal size={14} className="icon--w22" />
        </Link>
      </div>
    </footer>
  );
}

/** Trang công khai: hồ sơ doanh nghiệp hoặc hồ sơ tư vấn viên */
function publicHref(account: ReturnType<typeof useEmployerAccount>['account']): string {
  return account.company ? `/nha-tuyen-dung/${account.company.slug}` : `/tu-van-vien/${account.recruiter.slug}`;
}
