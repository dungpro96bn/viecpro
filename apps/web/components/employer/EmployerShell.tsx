'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TRASH_CATEGORIES } from '@viecpro/shared';
import NotificationMenu from '@/components/account/NotificationMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  IconBarChart,
  IconBriefcaseLine,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconCheckMark,
  IconChevronDown,
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
  IconTrash,
  IconUserRound,
} from '@/components/ui/Icons';
import { dayMonth, initialOf } from '@/lib/employer';
import { cx } from '@/lib/format';
import EmployerAccountProvider, { useEmployerAccount } from './EmployerAccountProvider';
import './employer.css';

export const EMPLOYER_BASE = '/quan-ly-tuyen-dung';

type NavItem = { href: string; label: string; icon: (p: { size?: number }) => ReactNode; count?: number; hot?: boolean; exact?: boolean; children?: Array<{ href: string; label: string }> };

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
  /** Mobile: ô tìm kiếm ẩn sau nút kính lúp, mở ra phủ cả thanh trên */
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

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
          <span className={cx('emp-personal__check', !account.recruiter.verified && 'emp-personal__check--pending')}>
            <IconCheck size={12} className="icon--w3" />
          </span>
          <b>Tài khoản cá nhân</b>
          <span className="emp-personal__meta">· {account.recruiter.verified ? 'Đã xác minh ViecPro' : 'Chưa xác minh ViecPro'}</span>
        </span>
      )}

      <form
        role="search"
        className={cx('emp-search', searchOpen && 'emp-search--open')}
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchRef.current?.value.trim();
          setSearchOpen(false);
          router.push(`${EMPLOYER_BASE}/ung-vien${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        }}
      >
        <IconSearch size={17} />
        <input
          ref={searchRef}
          type="search"
          className="emp-search__input"
          placeholder="Tìm ứng viên, số điện thoại, mã đơn…"
          aria-label="Tìm ứng viên"
          onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
        />
        <kbd className="emp-search__kbd">Ctrl K</kbd>
        <button type="button" className="emp-search__close" aria-label="Đóng tìm kiếm" onClick={() => setSearchOpen(false)}>
          <IconClose size={18} />
        </button>
      </form>

      <div className="emp-topbar__actions">
        <button type="button" className="emp-topbar__search-btn" aria-label="Tìm ứng viên" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}>
          <IconSearch size={20} />
        </button>
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
    { href: `${EMPLOYER_BASE}/khach-tu-van`, label: 'Khách cần tư vấn', icon: IconPhone, count: account.counts.leads, hot: true },
  ];
  const second: NavItem[] = company
    ? [
        { href: `${EMPLOYER_BASE}/bao-cao`, label: 'Báo cáo thống kê', icon: IconBarChart },
        { href: `${EMPLOYER_BASE}/danh-gia`, label: 'Đánh giá', icon: IconStarLine },
        { href: publicHref(account), label: 'Trang công ty', icon: IconBuilding },
        { href: `${EMPLOYER_BASE}/thanh-vien`, label: 'Thành viên', icon: IconMembers },
        { href: `${EMPLOYER_BASE}/cai-dat`, label: 'Cài đặt', icon: IconSettings },
        // Thùng rác: dữ liệu xoá mềm – doanh nghiệp chỉ quản trị viên mở được (API kiểm tra lại)
        ...(account.companyAdmin
          ? [
              {
                href: `${EMPLOYER_BASE}/thung-rac`,
                label: 'Thùng rác',
                icon: IconTrash,
                count: account.counts.trash,
                children: TRASH_CATEGORIES.map((c) => ({ href: `${EMPLOYER_BASE}/thung-rac/${c.path}`, label: c.label })),
              },
            ]
          : []),
      ]
    : [
        { href: `${EMPLOYER_BASE}/bao-cao`, label: 'Báo cáo thống kê', icon: IconBarChart },
        { href: `${EMPLOYER_BASE}#doanh-nghiep-phai-cu`, label: 'Đơn vị hợp tác', icon: IconBuilding, count: account.counts.partners },
        { href: publicHref(account), label: 'Hồ sơ cá nhân', icon: IconUserRound },
        { href: `${EMPLOYER_BASE}/danh-gia`, label: 'Đánh giá', icon: IconStarLine, count: account.counts.reviews },
        { href: `${EMPLOYER_BASE}/cai-dat`, label: 'Cài đặt', icon: IconSettings },
        // NTD cá nhân: thùng rác chỉ có tin của mình
        { href: `${EMPLOYER_BASE}/thung-rac/tin-tuyen-dung`, label: 'Thùng rác', icon: IconTrash, count: account.counts.trash },
      ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isActive = (item: NavItem) => item.href !== '#' && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
  /** Menu có mục con (Thùng rác): bấm để mở / đóng; đang ở trang con thì mở sẵn */
  const isOpen = (item: NavItem) => openGroups[item.label] ?? isActive(item);
  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <div key={item.label} className="emp-nav__entry">
        {item.children ? (
          <button
            type="button"
            className={cx('emp-nav__item emp-nav__toggle', active && 'emp-nav__item--active')}
            aria-expanded={isOpen(item)}
            aria-controls={`emp-sub-${item.label}`}
            onClick={() => setOpenGroups((g) => ({ ...g, [item.label]: !isOpen(item) }))}
          >
            <item.icon size={19} />
            <span className="emp-nav__label">{item.label}</span>
            {!!item.count && <span className={cx('emp-nav__count', item.hot && 'emp-nav__count--hot')}>{item.count}</span>}
            <IconChevronDown size={16} className={cx('emp-nav__chevron', isOpen(item) && 'emp-nav__chevron--open')} />
          </button>
        ) : (
          <Link href={item.href} className={cx('emp-nav__item', active && 'emp-nav__item--active')} aria-current={active ? 'page' : undefined}>
            <item.icon size={19} />
            <span className="emp-nav__label">{item.label}</span>
            {!!item.count && <span className={cx('emp-nav__count', item.hot && 'emp-nav__count--hot')}>{item.count}</span>}
          </Link>
        )}
        {item.children && isOpen(item) && (
          <ul className="emp-nav__sub" id={`emp-sub-${item.label}`} aria-label={item.label}>
            {item.children.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className={cx('emp-nav__subitem', pathname.startsWith(c.href) && 'emp-nav__subitem--active')} aria-current={pathname.startsWith(c.href) ? 'page' : undefined}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const plan = account.plan;
  return (
    <>
      <div className={cx('emp-sidebar__backdrop', open && 'emp-sidebar__backdrop--open')} onClick={onClose} aria-hidden="true" />
      <aside className={cx('emp-sidebar', open && 'emp-sidebar--open')} aria-label="Menu khu quản lý">
        {/* Đầu ngăn trượt (tablet / mobile): thông tin tổ chức + đăng tin – thay phần đã ẩn trên thanh trên */}
        <div className="emp-drawer-head">
          <div className="emp-drawer-head__org">
            {account.company?.logoUrl ? (
              <img className="emp-org__logo" src={account.company.logoUrl} alt="" />
            ) : (
              <span className="emp-org__logo emp-org__logo--text">{initialOf(account.company?.name ?? account.user.name)}</span>
            )}
            <span className="emp-drawer-head__text">
              <b>{account.company ? (account.company.shortName ?? account.company.name) : account.user.name}</b>
              <span>{account.company ? `${account.plan?.name ?? 'Gói miễn phí'} · ${account.company.memberCount} thành viên` : 'Tài khoản cá nhân'}</span>
            </span>
            <button type="button" className="emp-sidebar__close" aria-label="Đóng menu" onClick={onClose}>
              <IconClose size={18} />
            </button>
          </div>
          <Link href={`${EMPLOYER_BASE}/don-hang/dang-tin`} className="emp-drawer-head__post">
            <IconPlus size={17} className="icon--w22" />
            Đăng tin mới
          </Link>
        </div>
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
