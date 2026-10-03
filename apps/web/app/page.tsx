import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';
import Select from '@/components/ui/Select';
import { IconArrowRight, IconBriefcase, IconMap, IconPin, IconSearch } from '@/components/ui/Icons';
import HomeJobList from './_components/HomeJobList';
import RegionSlider from './_components/RegionSlider';
import { apiRecruiterToPoster } from '@/lib/api-mappers';
import { getHomepageContent, getLatestJobs, getRegionDirectory } from '@/lib/server-api';
import type { Poster } from '@/lib/types';
import type { JobListItem } from '@viecpro/shared';
import { cx, formatNumber } from '@/lib/format';
import './home.css';

const PREF_OPTIONS = ['Tokyo', 'Osaka', 'Aichi', 'Saitama', 'Kanagawa', 'Chiba', 'Hokkaido', 'Fukuoka'];

/** Số tỉnh hiện trong mỗi thẻ vùng */
const PREFS_PER_REGION = 7;

/** Nhà tuyển dụng nổi bật = người đăng nhiều đơn nhất (trong các đơn mới), rồi điểm cao nhất */
function featuredPosters(jobs: JobListItem[]) {
  const byId = new Map<string, { poster: Poster; count: number }>();
  for (const job of jobs) {
    const entry = byId.get(job.recruiter.id) ?? { poster: apiRecruiterToPoster(job), count: 0 };
    entry.count += 1;
    byId.set(job.recruiter.id, entry);
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || b.poster.rating - a.poster.rating).slice(0, 5);
}

export default async function HomePage() {
  const [directory, latest, content] = await Promise.all([getRegionDirectory(), getLatestJobs(), getHomepageContent()]);
  const regions = (directory ?? []).filter((r) => r.total > 0).map((r) => ({ ...r, prefCount: r.prefs.length, prefs: r.prefs.slice(0, PREFS_PER_REGION) }));
  const prefTotal = regions.reduce((sum, r) => sum + r.total, 0);
  const prefMax = Math.max(1, ...regions.flatMap((r) => r.prefs.map((p) => p.count)));
  const featured = featuredPosters(latest?.items ?? []);

  return (
    <div className="page page--fluid">
      <Header active="jobs" />

      {/* HERO */}
      <section className="home-hero">
        <span className="home-hero__blob home-hero__blob--1" />
        <span className="home-hero__blob home-hero__blob--2" />
        <div className="container home-hero__inner">
          <h1 className="home-hero__title">Tìm kiếm việc làm tại Nhật Bản</h1>

          <form role="search" action="/tim-kiem" className="hero-search">
            <label className="hero-search__field hero-search__field--grow">
              <IconSearch size={20} />
              <input type="text" name="q" aria-label="Từ khóa" placeholder="Ngành nghề, vị trí, xí nghiệp…" className="hero-search__input" />
            </label>
            <span className="hero-search__sep" />
            <label className="hero-search__field">
              <IconPin size={18} />
              <Select
                name="pref"
                aria-label="Tỉnh thành"
                className="hero-search__select hero-search__select--pref"
                options={[{ value: '', label: 'Tất cả tỉnh thành' }, ...PREF_OPTIONS]}
              />
            </label>
            <span className="hero-search__sep" />
            <label className="hero-search__field">
              <IconBriefcase size={18} />
              <Select
                name="prog"
                aria-label="Chương trình"
                className="hero-search__select hero-search__select--prog"
                options={[
                  { value: '', label: 'Tất cả chương trình' },
                  { value: 'tts', label: 'Thực tập sinh' },
                  { value: 'tok', label: 'Kỹ năng đặc định' },
                  { value: 'ks', label: 'Kỹ sư' },
                ]}
              />
            </label>
            <button type="submit" className="btn btn--primary hero-search__btn">
              Tìm việc
            </button>
          </form>

          {/* Danh bạ tỉnh thành Nhật Bản */}
          <nav className="pref-directory" aria-label="Việc làm theo tỉnh thành Nhật Bản">
            <div className="pref-directory__head">
              <div className="pref-directory__heading">
                <span className="pref-directory__icon">
                  <IconMap size={18} className="icon--w2" />
                </span>
                <div className="pref-directory__titles">
                  <span className="pref-directory__title">Việc làm theo tỉnh thành</span>
                  <span className="pref-directory__subtitle">{formatNumber(prefTotal)} đơn hàng đang tuyển tại 6 vùng Nhật Bản</span>
                </div>
              </div>
              <Link href="/tim-kiem" className="pref-directory__all">
                <span><span className="pref-directory__all-prefix">Xem đủ </span>47 tỉnh</span>
                <IconArrowRight size={14} className="icon--w22" />
              </Link>
            </div>

            <RegionSlider regions={regions.map(({ key, name }) => ({ key, name }))}>
              {regions.map((r) => {
                const total = r.total;
                const share = prefTotal ? Math.round((total / prefTotal) * 100) : 0;
                return (
                  <section key={r.key} className={cx('region-card', `region-card--${r.key}`)} aria-label={`Vùng ${r.name}`}>
                    <header className="region-card__head">
                      <div className="region-card__info">
                        <span className="region-card__name">{r.name}</span>
                        <span className="region-card__meta">
                          {r.prefCount} tỉnh · {share}% tổng đơn
                        </span>
                      </div>
                      <span className="region-card__total">
                        <strong>{formatNumber(total)}</strong> đơn
                      </span>
                    </header>

                    <ol className="region-card__prefs">
                      {r.prefs.map((p, i) => (
                        <li key={p.name}>
                          <Link
                            href={`/tim-kiem?pref=${p.name}`}
                            className={cx('pref-row', p.count >= 100 && 'pref-row--hot')}
                            aria-label={`${p.name}: ${p.count} đơn hàng`}
                          >
                            <span className="pref-row__rank">{i + 1}</span>
                            <span className="pref-row__name">{p.name}</span>
                            <span className="pref-row__bar" aria-hidden="true">
                              <span style={{ width: `${Math.max(4, (p.count / prefMax) * 100)}%` }} />
                            </span>
                            <span className="pref-row__count">{p.count}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </section>
                );
              })}
            </RegionSlider>
          </nav>
        </div>
      </section>

      {/* MAIN */}
      <main className="home-main page-main">
        <div className="container home-main__inner">
          <HomeJobList />

          {/* SIDEBAR / QUẢNG CÁO */}
          <aside className="home-aside" aria-label="Quảng cáo và hỗ trợ">
            {content?.employerBanner.enabled && (
              <Link href={content.employerBanner.href} className="ad-employer">
                <img className="ad-employer__img" src={content.employerBanner.image} alt="" />
                <span className="ad-employer__shade" />
                <span className="ad-employer__top">
                  <span className="ad-employer__tag">{content.employerBanner.tag}</span>
                  <span className="ad-label">Tài trợ</span>
                </span>
                <span className="ad-employer__body">
                  <span className="ad-employer__title">{content.employerBanner.title}</span>
                  <span className="ad-employer__desc">{content.employerBanner.description}</span>
                  <span className="btn btn--primary btn--pill ad-employer__cta">
                    {content.employerBanner.cta}
                    <IconArrowRight size={16} className="icon--w22" />
                  </span>
                </span>
              </Link>
            )}

            <div className="featured-employers">
              <div className="featured-employers__head">
                <span className="featured-employers__title">Nhà tuyển dụng nổi bật</span>
              </div>
              <div className="featured-employers__list">
                {featured.map(({ poster, count }) => (
                  <Link key={poster.id} href={poster.href ?? '#'} className="featured-employer">
                    <Avatar src={poster.photo} size={44} verified />
                    <span className="featured-employer__info">
                      <span className="featured-employer__name">{poster.name}</span>
                      <span className="featured-employer__rating">
                        <Stars rating={poster.rating} size={12} />
                        <span className="featured-employer__score">{poster.rating.toFixed(1)}</span>
                      </span>
                    </span>
                    <span className="featured-employer__count">{count} đơn</span>
                  </Link>
                ))}
              </div>
            </div>

            {content?.courseBanner.enabled && (
              <Link href={content.courseBanner.href} className="ad-course">
                <img className="ad-course__img" src={content.courseBanner.image} alt="" />
                <span className="ad-course__shade" />
                <span className="ad-label ad-course__label">Quảng cáo</span>
                <span className="ad-course__body">
                  <span className="ad-course__eyebrow">{content.courseBanner.tag}</span>
                  <span className="ad-course__title">{content.courseBanner.title}</span>
                  <span className="ad-course__cta">{content.courseBanner.cta}</span>
                </span>
              </Link>
            )}

            {!!content?.miniAds.some((ad) => ad.enabled) && (
              <div className="mini-ads">
                <div className="mini-ads__head">
                  <span className="mini-ads__title">{content.miniAdsTitle}</span>
                  <span className="ad-label ad-label--muted">Tài trợ</span>
                </div>
                {content.miniAds.filter((ad) => ad.enabled).map((ad) => (
                  <Link key={ad.id} href={ad.href} className="mini-ad">
                    <img className="mini-ad__img" src={ad.image} alt="" loading="lazy" />
                    <span className={cx('mini-ad__overlay', `mini-ad__overlay--${ad.id}`)} />
                    <span className="mini-ad__body">
                      <span className="mini-ad__tag">{ad.tag}</span>
                      <span className="mini-ad__text">
                        <span className="mini-ad__title">{ad.title}</span>
                        <span className="mini-ad__cta">
                          {ad.cta}
                          <IconArrowRight size={13} className="icon--w24" />
                        </span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
