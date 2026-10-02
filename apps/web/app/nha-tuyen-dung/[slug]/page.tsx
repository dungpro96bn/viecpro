import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SectionTabs from '@/components/layout/SectionTabs';
import ConsultForm from '@/components/profile/ConsultForm';
import ContactList from '@/components/profile/ContactList';
import FollowButton from '@/components/profile/FollowButton';
import ProfileActionBar from '@/components/profile/ProfileActionBar';
import ProfileJobs from '@/components/profile/ProfileJobs';
import Select from '@/components/ui/Select';
import {
  IconBuilding,
  IconBuildingSimple,
  IconChat,
  IconPhone,
  IconPin,
  IconShieldCheck,
  IconStar,
  IconTeam,
  IconWarning,
  PathIcon,
} from '@/components/ui/Icons';
import { formatVnContactPhone } from '@viecpro/shared';
import { getEmployerProfile, getProfileJobs } from '@/lib/server-api';
import { apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';
import { toApplyJob } from '@/lib/data';
import type { ContactIcon } from '@/lib/profiles';
import { formatNumber } from '@/lib/format';
import { cx } from '@/lib/format';
import '@/components/profile/profile.css';
import './employer.css';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const profile = await getEmployerProfile((await params).slug);
  return { title: profile?.name ?? 'Nhà tuyển dụng' };
}

const TABS = [
  { id: 'gioi-thieu', label: 'Giới thiệu' },
  { id: 'don-hang', label: 'Đơn hàng đang tuyển' },
  { id: 'doi-ngu', label: 'Đội ngũ tư vấn' },
  { id: 'lien-he', label: 'Liên hệ' },
];

export default async function EmployerPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [profile, jobPage] = await Promise.all([getEmployerProfile(slug), getProfileJobs({ employer: slug })]);
  if (!profile) notFound();
  const sections = profile.sections;
  const strings = (key: string) => Array.isArray(sections[key]) ? (sections[key] as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const rows = (key: string) => Array.isArray(sections[key]) ? (sections[key] as unknown[]).flatMap((item) => Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string' && typeof item[1] === 'string' ? [[item[0], item[1]] as [string, string]] : []) : [];
  const objects = (key: string) => Array.isArray(sections[key]) ? (sections[key] as unknown[]).filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
  const items = jobPage?.items ?? [];
  const c = {
    slug: profile.slug,
    name: profile.name,
    shortName: profile.shortName ?? profile.name,
    phone: profile.phone ? formatVnContactPhone(profile.phone) : '',
    intro: profile.intro ?? '',
    stats: [...rows('stats'), [String(jobPage?.total ?? 0), 'Đơn đang tuyển'], [String(profile.followerCount), 'Người theo dõi']],
    values: objects('values').map((item) => ({ title: String(item.title ?? ''), desc: String(item.desc ?? ''), icon: 'M4 12l5 5L20 6' })),
    offices: strings('offices'),
    fields: strings('fields'),
    jobTotals: profile.jobCounts,
    team: profile.team.map((member) => ({ name: member.name, role: member.title, photo: member.photoUrl ?? '', rating: member.rating.toFixed(1), jobs: 0, online: false, href: `/tu-van-vien/${member.slug}` })),
    contacts: [
      ...(profile.phone ? [{ label: 'Điện thoại', value: formatVnContactPhone(profile.phone), icon: 'phone' as ContactIcon }] : []),
      ...(profile.email ? [{ label: 'Email', value: profile.email, icon: 'mail' as ContactIcon }] : []),
      ...(profile.website ? [{ label: 'Website', value: profile.website, icon: 'web' as ContactIcon }] : []),
      ...(profile.address ? [{ label: 'Địa chỉ', value: profile.address, icon: 'pin' as ContactIcon }] : []),
    ],
    legal: rows('legal'),
    jobs: items.map((item) => {
      const job = apiJobToView(item);
      const poster = apiRecruiterToPoster(item);
      return { job, applyJob: toApplyJob(job, profile.name, poster), footer: { avatar: poster.photo, prefix: 'Phụ trách:', name: poster.name, meta: [`${formatNumber(job.views)} lượt xem`, job.posted] } };
    }),
  };

  return (
    <div className="page page--fluid page--profile">
      <Header active="employers" />

      {/* ẢNH BÌA + HỒ SƠ */}
      <section className="profile-hero">
        <div className="profile-cover employer-cover">
          <img className="employer-cover__img" src={profile.coverUrl ?? '/images/banners/employer-cover.jpg'} alt="" />
          <span className="employer-cover__shade" />
          <nav className="container breadcrumb breadcrumb--light profile-cover__crumb" aria-label="Breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span className="breadcrumb__sep">/</span>
            <Link href="#">Nhà tuyển dụng</Link>
            <span className="breadcrumb__sep">/</span>
            <span className="breadcrumb__current">{c.shortName}</span>
          </nav>
        </div>

        <div className="container profile-card-wrap employer-card-wrap">
          <div className="profile-card">
            <div className="profile-card__top">
            <span className="employer-logo" role="img" aria-label={`Logo ${c.name}`}>
              {profile.logoUrl ? <img className="employer-logo__image" src={profile.logoUrl} alt="" /> : <IconBuilding size={34} className="icon--w16" />}
              </span>
              <div className="profile-card__main">
                <div className="profile-card__pills">
                  {profile.verified && <span className="pill pill--success">
                    <IconShieldCheck size={13} className="icon--w24" />
                    Doanh nghiệp đã xác minh
                  </span>}
                </div>
                <h1 className="profile-card__name">{c.name}</h1>
                <div className="profile-card__meta">
                  {profile.address && <span><IconPin size={15} />{profile.address}</span>}
                  {profile.website && <span><IconBuildingSimple size={15} />{profile.website}</span>}
                </div>
              </div>
              <div className="profile-card__actions">
                <FollowButton kind="employers" slug={c.slug} initialFollowing={profile.following ?? false} />
                <a href="#tu-van" className="btn btn--primary profile-card__cta">
                  <IconChat size={17} className="icon--w2" />
                  Nhận tư vấn
                </a>
              </div>
            </div>

            <div className="profile-stats">
              {c.stats.map(([v, k]) => (
                <div key={k} className="profile-stats__item">
                  <span className="profile-stats__value">{v}</span>
                  <span className="profile-stats__label">{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionTabs
        label="Mục lục hồ sơ"
        items={TABS}
        className="profile-tabs"
        actions={
          <>
            <a href="#lien-he" className="btn btn--outline profile-tabs__phone">
              <IconPhone size={16} />
              Thông tin liên hệ
            </a>
            <a href="#tu-van" className="btn btn--primary btn--sm profile-tabs__cta">
              Nhận tư vấn
            </a>
          </>
        }
      />

      {/* NỘI DUNG */}
      <main className="profile-main page-main">
        <div className="container profile-main__inner">
          <div className="profile-content">
            <section id="gioi-thieu" className="content-card">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconBuilding size={19} />
                </span>
                <h2 className="content-card__title">Giới thiệu doanh nghiệp</h2>
              </div>
              <p className="profile-text">{c.intro}</p>
              <div className="value-grid">
                {c.values.map((v) => (
                  <div key={v.title} className="value-item">
                    <span className="value-item__icon">
                      <PathIcon d={v.icon} size={17} />
                    </span>
                    <span className="value-item__text">
                      <span className="value-item__title">{v.title}</span>
                      <span className="value-item__desc">{v.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="tag-groups">
                <div className="tag-group">
                  <span className="tag-group__title">Văn phòng tại Việt Nam</span>
                  <div className="tag-group__list">
                    {c.offices.map((m) => (
                      <span key={m} className="soft-tag soft-tag--outline">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="tag-group">
                  <span className="tag-group__title">Lĩnh vực hoạt động</span>
                  <div className="tag-group__list">
                    {c.fields.map((m) => (
                      <span key={m} className="soft-tag soft-tag--brand">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <ProfileJobs
              title="Đơn hàng đang tuyển"
              items={c.jobs}
              totals={c.jobTotals}
              caption="tin tuyển dụng đang mở"
              viewAllLabel={`Xem tất cả đơn hàng của ${c.shortName}`}
            />

            <section id="doi-ngu" className="content-card">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconTeam size={19} />
                </span>
                <h2 className="content-card__title">Đội ngũ tư vấn</h2>
              </div>
              <div className="team-grid">
                {c.team.map((m) => (
                  <div key={m.name} className="team-member">
                    <span className="team-member__photo">
                      <img className="team-member__img" src={m.photo} alt="" loading="lazy" />
                      <span className={cx('team-member__status', m.online && 'team-member__status--online')} />
                    </span>
                    <span className="team-member__who">
                      <span className="team-member__name">{m.name}</span>
                      <span className="team-member__role">{m.role}</span>
                    </span>
                    <span className="team-member__stats">
                      <span className="team-member__rating">
                        <IconStar size={12} className="team-member__star" />
                        {m.rating}
                      </span>
                      <span>{m.jobs} đơn phụ trách</span>
                    </span>
                    <div className="team-member__actions">
                    <Link href={m.href} className="btn btn--outline team-member__btn" aria-label={`Xem hồ sơ ${m.name}`}>
                      <IconPhone size={15} />
                      Xem hồ sơ
                    </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="profile-aside">
            <div id="lien-he" className="side-card">
              <span className="side-card__title">Thông tin liên hệ</span>
              <ContactList items={c.contacts} />
              <div className="contact-actions">
                <a href="#lien-he" className="btn btn--primary contact-actions__btn">
                  <IconPhone size={16} className="icon--w2" />
                  Thông tin liên hệ
                </a>
                <a href="#tu-van" className="btn btn--outline contact-actions__btn">
                  <IconChat size={16} />
                  Nhờ tư vấn
                </a>
              </div>
            </div>

            <ConsultForm
              title="Đăng ký tư vấn miễn phí"
              description={`Để lại thông tin, cán bộ tư vấn của ${c.shortName} sẽ liên hệ lại với bạn.`}
              successTitle="Đã gửi yêu cầu!"
              successText="Cán bộ tư vấn sẽ liên hệ bạn trong khoảng 30 phút (giờ hành chính)."
              employerSlug={c.slug}
              extraFields={
                <Select
                  className="field-input field-input--select field-input--bare"
                  aria-label="Chương trình quan tâm"
                  placeholder="Chương trình quan tâm"
                  options={['Thực tập sinh', 'Kỹ năng đặc định', 'Kỹ sư']}
                />
              }
            />

            <div className="side-card side-card--tight">
              <span className="side-card__title">Thông tin pháp lý</span>
              <div className="legal-list">
                {c.legal.map(([k, v]) => (
                  <div key={k} className="legal-list__row">
                    <span className="legal-list__key">{k}</span>
                    <span className="legal-list__value">{v}</span>
                  </div>
                ))}
              </div>
              <Link href="#" className="side-card__link">
                <IconWarning size={14} />
                Báo cáo thông tin sai
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
      <ProfileActionBar callHref="#lien-he" callLabel="Thông tin liên hệ" ctaLabel="Nhận tư vấn" />
    </div>
  );
}
