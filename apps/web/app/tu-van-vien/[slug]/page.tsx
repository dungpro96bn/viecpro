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
  IconChatSquare,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconMedal,
  IconPhone,
  IconPin,
  IconShieldCheck,
  IconStar,
  IconTrophy,
  IconUserRound,
  IconWarning,
  PathIcon,
} from '@/components/ui/Icons';
import type { ContactIcon } from '@/lib/profiles';
import { getProfileJobs, getRecruiterProfile } from '@/lib/server-api';
import { apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';
import { toApplyJob } from '@/lib/data';
import { formatNumber } from '@/lib/format';
import { cx } from '@/lib/format';
import '@/components/profile/profile.css';
import './recruiter.css';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const profile = await getRecruiterProfile((await params).slug);
  return { title: profile ? `${profile.name} – Nhà tuyển dụng cá nhân` : 'Nhà tuyển dụng cá nhân' };
}

const TABS = [
  { id: 'gioi-thieu', label: 'Giới thiệu' },
  { id: 'don-hang', label: 'Đơn hàng đang đăng' },
  { id: 'kinh-nghiem', label: 'Kinh nghiệm' },
  { id: 'hop-tac', label: 'Đơn vị hợp tác' },
  { id: 'lien-he', label: 'Liên hệ' },
];

export default async function RecruiterPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [profile, jobPage] = await Promise.all([getRecruiterProfile(slug), getProfileJobs({ recruiter: slug })]);
  if (!profile) notFound();
  const sections = profile.sections;
  const strings = (key: string) => Array.isArray(sections[key]) ? (sections[key] as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const rows = (key: string) => Array.isArray(sections[key]) ? (sections[key] as unknown[]).flatMap((item) => Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string' && typeof item[1] === 'string' ? [[item[0], item[1]] as [string, string]] : []) : [];
  const objects = (key: string) => Array.isArray(sections[key]) ? (sections[key] as unknown[]).filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
  const poster = { id: profile.id, name: profile.name, role: profile.title, photo: profile.photoUrl ?? undefined, rating: profile.rating, city: profile.city ?? '', href: `/tu-van-vien/${profile.slug}` };
  const records = jobPage?.items ?? [];
  const r = {
    slug: profile.slug,
    poster,
    name: profile.name,
    headline: profile.headline ?? profile.title,
    phoneMasked: profile.phoneMasked ?? 'Chưa có số liên hệ',
    intro: profile.intro ?? '',
    stats: [...rows('stats'), [String(jobPage?.total ?? 0), 'Đơn đang đăng'], [String(profile.followerCount), 'Người theo dõi']],
    values: objects('values').map((item) => ({ title: String(item.title ?? ''), desc: String(item.desc ?? ''), icon: 'M4 12l5 5L20 6' })),
    fields: strings('fields'),
    prefectures: strings('prefectures'),
    jobTotals: profile.jobCounts,
    timeline: objects('timeline').map((item) => ({ when: String(item.when ?? ''), title: String(item.title ?? ''), desc: String(item.desc ?? '') })),
    certificates: objects('certificates').map((item) => ({ title: String(item.title ?? ''), desc: String(item.desc ?? '') })),
    partners: profile.employer ? [{ name: profile.employer.name, note: profile.employer.verified ? 'Nhà tuyển dụng đã xác minh' : 'Hồ sơ nhà tuyển dụng', logo: profile.employer.logoUrl ?? '', href: `/nha-tuyen-dung/${profile.employer.slug}` }] : [],
    contacts: profile.phoneMasked ? [{ label: 'Điện thoại', value: profile.phoneMasked, icon: 'phone' as ContactIcon }] : [],
    checks: objects('checks').map((item) => ({ title: String(item.title ?? ''), note: String(item.note ?? ''), ok: Boolean(item.ok) })),
    jobs: records.map((item) => {
      const job = apiJobToView(item);
      const jobPoster = apiRecruiterToPoster(item);
      return { job, applyJob: toApplyJob(job, item.employer?.name ?? profile.name, jobPoster), footer: { avatar: jobPoster.photo, prefix: 'Đăng bởi', name: jobPoster.name, meta: [`${formatNumber(job.views)} lượt xem`, job.posted] } };
    }),
  };
  const name = r.name;

  return (
    <div className="page page--fluid page--profile">
      <Header active="employers" />

      {/* ẢNH BÌA + HỒ SƠ CÁ NHÂN */}
      <section className="profile-hero">
        <div className="profile-cover recruiter-cover">
          <span className="recruiter-cover__circle recruiter-cover__circle--1" />
          <span className="recruiter-cover__circle recruiter-cover__circle--2" />
          <nav className="container breadcrumb breadcrumb--light profile-cover__crumb" aria-label="Breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span className="breadcrumb__sep">/</span>
            <Link href="#">Nhà tuyển dụng</Link>
            <span className="breadcrumb__sep">/</span>
            <span className="breadcrumb__current">{name}</span>
          </nav>
        </div>

        <div className="container profile-card-wrap recruiter-card-wrap">
          <div className="profile-card">
            <div className="profile-card__top">
              <span className="recruiter-avatar">
                <img className="recruiter-avatar__img" src={r.poster.photo} alt={`Ảnh đại diện ${name}`} />
                <span className="recruiter-avatar__online" title="Đang hoạt động" />
              </span>
              <div className="profile-card__main">
                <div className="profile-card__pills">
                  <span className="pill pill--brand recruiter-pill">
                    <IconUserRound size={13} className="icon--w22" />
                    Nhà tuyển dụng cá nhân
                  </span>
                  {profile.employer?.verified && <span className="pill pill--success">
                    <IconShieldCheck size={13} className="icon--w24" />
                    Đã xác minh danh tính
                  </span>}
                  <span className="pill pill--warning">Phản hồi nhanh</span>
                </div>
                <h1 className="profile-card__name">{name}</h1>
                <span className="recruiter-headline">{r.headline}</span>
                <div className="profile-card__meta">
                  <span>
                    <IconStar size={15} className="recruiter-star" />
                    <b className="recruiter-score">{profile.rating.toFixed(1)}</b>/5
                  </span>
                  <span>
                    <IconPin size={15} />
                    {profile.city ?? 'Chưa cập nhật khu vực'}
                  </span>
                  <span>
                    <IconChatSquare size={15} />
                    {r.headline}
                  </span>
                  <span>
                    <IconClock size={15} />
                    Hồ sơ tư vấn viecpro
                  </span>
                </div>
              </div>
              <div className="profile-card__actions">
                <FollowButton kind="recruiters" slug={r.slug} initialFollowing={profile.following ?? false} />
                <a href="#" className="icon-btn recruiter-zalo" aria-label="Nhắn Zalo">
                  <span className="zalo-mark zalo-mark--lg">Zalo</span>
                </a>
                <a href="#tu-van" className="btn btn--primary profile-card__cta">
                  <IconPhone size={17} className="icon--w2" />
                  Nhờ tư vấn
                </a>
              </div>
            </div>

            <div className="profile-stats">
              {r.stats.map(([v, k]) => (
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
              {r.phoneMasked}
            </a>
            <a href="#tu-van" className="btn btn--primary btn--sm profile-tabs__cta">
              Nhờ tư vấn
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
                  <IconUserRound size={19} />
                </span>
                <h2 className="content-card__title">Giới thiệu</h2>
              </div>
              <p className="profile-text">{r.intro}</p>
              <div className="value-grid">
                {r.values.map((v) => (
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
                  <span className="tag-group__title">Chuyên tuyển ngành</span>
                  <div className="tag-group__list">
                    {r.fields.map((m) => (
                      <span key={m} className="soft-tag soft-tag--brand">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="tag-group">
                  <span className="tag-group__title">Tỉnh thành thường tuyển</span>
                  <div className="tag-group__list">
                    {r.prefectures.map((m) => (
                      <span key={m} className="soft-tag soft-tag--outline">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <ProfileJobs
              title="Đơn hàng đang đăng"
              items={r.jobs}
              totals={r.jobTotals}
              caption="tin tuyển dụng đang mở"
              viewAllLabel={`Xem tất cả 12 đơn của ${name}`}
            />

            <section id="kinh-nghiem" className="content-card content-card--gap20">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconTrophy size={19} />
                </span>
                <h2 className="content-card__title">Kinh nghiệm &amp; chứng chỉ</h2>
              </div>
              <ol className="timeline">
                {r.timeline.map((t, i) => (
                  <li key={t.when} className={cx('timeline__item', i === 0 && 'timeline__item--current')}>
                    <div className="timeline__rail">
                      <span className="timeline__dot" />
                      <span className="timeline__line" />
                    </div>
                    <div className="timeline__body">
                      <span className="timeline__when">{t.when}</span>
                      <span className="timeline__title">{t.title}</span>
                      <span className="timeline__desc">{t.desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="cert-grid">
                {r.certificates.map((c) => (
                  <div key={c.title} className="cert">
                    <span className="cert__icon">
                      <IconMedal size={18} />
                    </span>
                    <span className="cert__text">
                      <span className="cert__title">{c.title}</span>
                      <span className="cert__desc">{c.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section id="hop-tac" className="content-card">
              <div className="content-card__head">
                <span className="content-card__icon">
                  <IconBuilding size={19} />
                </span>
                <div className="content-card__titles">
                  <h2 className="content-card__title">Doanh nghiệp phái cử hợp tác</h2>
                  <span className="content-card__subtitle">Hợp đồng và hồ sơ xuất cảnh được ký với doanh nghiệp có giấy phép XKLĐ</span>
                </div>
              </div>
              <div className="partner-grid">
                {r.partners.map((p) => (
                  <Link key={p.name} href={p.href} className="partner">
                    <img className="partner__logo" src={p.logo} alt="" />
                    <span className="partner__text">
                      <span className="partner__name">{p.name}</span>
                      <span className="partner__note">{p.note}</span>
                    </span>
                    <IconChevronRight size={18} className="partner__arrow" />
                  </Link>
                ))}
              </div>
              <div role="note" className="note-warning">
                <IconWarning size={20} className="icon--w2" />
                <span>
                  <b>Lưu ý:</b> Nhà tuyển dụng cá nhân không được thu tiền trực tiếp. Mọi khoản phí phải thanh toán qua doanh nghiệp phái cử và có
                  hóa đơn, hợp đồng rõ ràng.
                </span>
              </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="profile-aside">
            <div id="lien-he" className="side-card">
              <div className="side-card__head">
                <span className="side-card__title">Liên hệ trực tiếp</span>
                <span className="online-status">
                  <span className="online-status__dot" />
                  Đang trực tuyến
                </span>
              </div>
              <ContactList items={r.contacts} recruiterSlug={r.slug} />
              <div className="contact-actions">
                <a href="#lien-he" className="btn btn--primary contact-actions__btn">
                  <IconPhone size={16} className="icon--w2" />
                  Hiện số liên hệ
                </a>
                <a href="#tu-van" className="btn btn--outline contact-actions__btn">
                  <IconChatSquare size={16} />
                  Nhờ tư vấn
                </a>
              </div>
            </div>

            <ConsultForm
              title={`Nhờ ${name} tư vấn đơn phù hợp`}
              description="Để lại số điện thoại, nhà tuyển dụng sẽ liên hệ lại với bạn."
              successTitle={`Đã gửi cho ${name}!`}
              successText={`${name} sẽ liên hệ lại với bạn.`}
              recruiterSlug={r.slug}
              extraFields={
                <div className="consult-box__row">
                  <Select
                    className="field-input field-input--select field-input--bare"
                    aria-label="Năm sinh"
                    placeholder="Năm sinh"
                    options={['1990 – 1995', '1996 – 2000', '2001 – 2007']}
                  />
                  <Select
                    className="field-input field-input--select field-input--bare"
                    aria-label="Ngành quan tâm"
                    placeholder="Ngành quan tâm"
                    options={['Điện tử', 'Thực phẩm', 'Nhà hàng']}
                  />
                </div>
              }
            />

            <div className="side-card side-card--tight">
              <span className="side-card__title">Xác minh &amp; minh bạch</span>
              <div className="verify-list">
                {r.checks.map((c) => (
                  <div key={c.title} className="verify-item">
                    <span className={cx('verify-item__icon', c.ok && 'verify-item__icon--ok')}>
                      {c.ok ? <IconCheck size={12} className="icon--w3" /> : <PathIcon d="M7 12h10" size={12} className="icon--w3" />}
                    </span>
                    <span className="verify-item__title">{c.title}</span>
                    <span className="verify-item__note">{c.note}</span>
                  </div>
                ))}
              </div>
              <Link href="#" className="side-card__link verify-report">
                <IconWarning size={14} />
                Báo cáo nhà tuyển dụng này
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
      <ProfileActionBar callHref="#lien-he" callLabel="Liên hệ" ctaLabel="Nhờ tư vấn" />
    </div>
  );
}
