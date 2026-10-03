'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { WEB_LINKS } from '@viecpro/shared';
import NotificationMenu from '@/components/account/NotificationMenu';
import { useAuth } from '@/components/auth/AuthProvider';
import Footer from '@/components/layout/Footer';
import Logo from '@/components/layout/Logo';
import { IconBellLine, IconCamera, IconChat, IconHeart, IconHome, IconLogout, IconPhone, IconSend, IconSettings, IconUser, IconZaloApp } from '@/components/ui/Icons';
import { telHref, zaloHref } from '@/lib/employer';
import { cx } from '@/lib/format';
import SeekerAccountProvider, { useSeekerAccount } from './SeekerAccountProvider';
import './seeker.css';

export const SEEKER_BASE = WEB_LINKS.seekerAccount;

// Giống menu header công khai (Chương trình, Cẩm nang, Tư vấn chưa có trang)
const HEADER_LINKS = [
  { href: '/tim-kiem', label: 'Việc làm' },
  { href: '#', label: 'Chương trình' },
  { href: '#', label: 'Cẩm nang' },
  { href: '#', label: 'Tư vấn' },
  { href: '/nha-tuyen-dung/viet-nam-camcom', label: 'Nhà tuyển dụng' },
];

/** Khung tài khoản ứng viên: header, thẻ hồ sơ, menu, cán bộ tư vấn, footer */
export default function SeekerShell({ children }: { children: ReactNode }) {
  return (
    <div className="page page--fluid account-page">
      <SeekerAccountProvider
        fallback={
          <div className="account-loading" role="status">
            Đang tải dữ liệu tài khoản…
          </div>
        }
      >
        <SeekerFrame>{children}</SeekerFrame>
      </SeekerAccountProvider>
    </div>
  );
}

function SeekerFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, dashboard, unreadMessages } = useSeekerAccount();
  const consultant = dashboard.consultant;
  const contact = dashboard.consultantContact;

  const nav = [
    { href: SEEKER_BASE, label: 'Tổng quan', icon: IconHome, count: '' },
    { href: `${SEEKER_BASE}/ho-so`, label: 'Hồ sơ của tôi', icon: IconUser, count: `${profile.completion}%` },
    { href: WEB_LINKS.seekerApplications, label: 'Việc đã ứng tuyển', icon: IconSend, count: String(dashboard.applications.total) },
    { href: `${SEEKER_BASE}/tin-nhan`, label: 'Tin nhắn', icon: IconChat, count: unreadMessages ? String(unreadMessages) : '' },
    { href: WEB_LINKS.seekerSaved, label: 'Việc đã lưu', icon: IconHeart, count: String(dashboard.saved.total) },
    { href: WEB_LINKS.seekerAlerts, label: 'Thông báo việc làm', icon: IconBellLine, count: '' },
    { href: WEB_LINKS.seekerSettings, label: 'Cài đặt', icon: IconSettings, count: '' },
  ];
  const isActive = (href: string) => (href === SEEKER_BASE ? pathname === SEEKER_BASE : pathname.startsWith(href));
  const navRef = useRef<HTMLElement>(null);
  // Mobile: menu là hàng cuộn ngang – cuộn mục đang mở vào giữa màn hình
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);
  const meta = [profile.gender === 'nu' ? 'Nữ' : profile.gender === 'nam' ? 'Nam' : '', profile.birthYear ? `${new Date().getFullYear() - profile.birthYear} tuổi` : '', profile.hometown ?? ''].filter(Boolean).join(' · ');

  return (
    <>
      <header className="account-header">
        <div className="container account-header__inner">
          <div className="account-header__left">
            <Logo />
            <nav className="account-header__nav" aria-label="Điều hướng chính">
              {HEADER_LINKS.map((l) => (
                <Link key={l.label} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="account-header__tools">
            <Link className="account-header__icon" href={WEB_LINKS.seekerSaved} aria-label="Việc đã lưu">
              <IconHeart size={21} />
            </Link>
            <NotificationMenu tone="light" />
            <span className="account-header__divider" />
            <Link className="account-header__profile" href={`${SEEKER_BASE}/ho-so`} aria-label={`Hồ sơ của ${profile.name}`}>
              <span className="account-avatar account-avatar--small">{profile.avatarUrl ? <img className="account-avatar__image" src={profile.avatarUrl} alt="" /> : profile.name.trim().split(/\s+/).pop()?.charAt(0)}</span>
              <span className="account-header__name">{profile.name}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="account-main page-main">
        <div className="container account-layout">
          <aside className={cx('account-sidebar', pathname !== SEEKER_BASE && 'account-sidebar--sub')} aria-label="Tài khoản">
            <section className="account-profile-card">
              <div className="account-profile-card__cover">
                <span />
              </div>
              <div className="account-profile-card__body">
                <span className="account-profile-card__avatar-wrap">
                  <span className="account-avatar account-avatar--large">{profile.avatarUrl ? <img className="account-avatar__image" src={profile.avatarUrl} alt={`Ảnh đại diện ${profile.name}`} /> : profile.name.trim().split(/\s+/).pop()?.charAt(0)}</span>
                  <Link className="account-profile-card__camera" href={`${SEEKER_BASE}/ho-so#anh-dai-dien`} aria-label="Cập nhật ảnh đại diện">
                    <IconCamera size={13} />
                  </Link>
                </span>
                <strong className="account-profile-card__name">{profile.name}</strong>
                <span className="account-profile-card__meta">{meta || 'Chưa cập nhật thông tin'}</span>
                <span className={cx('account-status', !profile.lookingForJob && 'account-status--off')}>
                  <i />
                  {profile.lookingForJob ? 'Đang tìm việc' : 'Tạm ngừng tìm việc'}
                </span>
                <div className="account-profile-card__completion">
                  <span>
                    <span>Mức hoàn thiện hồ sơ</span>
                    <b>{profile.completion}%</b>
                  </span>
                  <span className="account-progress">
                    <i style={{ width: `${profile.completion}%` }} />
                  </span>
                </div>
              </div>
            </section>

            <nav className="account-side-nav" aria-label="Mục tài khoản" ref={navRef}>
              {nav.map(({ href, label, icon: Icon, count }) => {
                const active = isActive(href);
                return (
                  <Link key={label} href={href} className={cx('account-side-nav__item', active && 'account-side-nav__item--active')} aria-current={active ? 'page' : undefined}>
                    <Icon size={18} />
                    <span>{label}</span>
                    {count && <b>{count}</b>}
                  </Link>
                );
              })}
              <button type="button" className="account-side-nav__logout" onClick={() => void signOut().then(() => router.push('/dang-nhap'))}>
                <IconLogout size={18} />
                Đăng xuất
              </button>
            </nav>

            {consultant && (
              <section className="account-advisor">
                <span className="account-advisor__eyebrow">Cán bộ tư vấn của bạn</span>
                <div className="account-advisor__person">
                  <span className="account-advisor__photo">{consultant.photoUrl && <img src={consultant.photoUrl} alt="" />}</span>
                  <span className="account-advisor__info">
                    <b>{consultant.name}</b>
                    <small className={cx(!contact?.online && 'account-advisor__offline')}>
                      <i />
                      {contact?.online ? 'Đang trực tuyến' : consultant.title}
                    </small>
                  </span>
                </div>
                <div className="account-advisor__actions">
                  {contact?.phone ? (
                    <>
                      <a href={telHref(contact.phone)} className="btn btn--outline btn--sm">
                        <IconPhone size={14} />
                        Gọi
                      </a>
                      <a href={zaloHref(contact.phone)} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm">
                        <IconZaloApp size={14} />
                        Zalo
                      </a>
                    </>
                  ) : (
                    // Chưa có API: nhắn tin trong app với cán bộ tư vấn – tạm mở trang hồ sơ cán bộ
                    <Link href={`/tu-van-vien/${consultant.slug}`} className="btn btn--outline btn--sm account-advisor__wide">
                      <IconChat size={14} />
                      Nhắn
                    </Link>
                  )}
                </div>
              </section>
            )}
          </aside>

          <div className="account-content">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
