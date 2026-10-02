'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import JobCard from '@/components/jobs/JobCard';
import Select from '@/components/ui/Select';
import {
  IconBriefcase,
  IconCheck,
  IconChevronLeft,
  IconClose,
  IconChevronRight,
  IconCloseSmall,
  IconFilter,
  IconPin,
  IconSearch,
  IconSliders,
} from '@/components/ui/Icons';
import { REGION_LABEL, toApplyJob } from '@/lib/data';
import { PROGRAM_LABEL, cx, formatNumber } from '@/lib/format';
import type { Job, JobTag, Program, RegionKey } from '@/lib/types';
import { INDUSTRIES, type DepartureWithin, type Industry, type JobFacets, type JobListItem, type Paginated } from '@viecpro/shared';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiMessage, apiRequest } from '@/lib/api';
import { apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';

/* ---------- Cấu hình bộ lọc ---------- */
const PROGRAMS: Program[] = ['tts', 'tok', 'ks'];
const REGIONS: RegionKey[] = ['hkt', 'kanto', 'chubu', 'kansai', 'cs', 'kyu'];
const FEATURES: JobTag[] = ['Đơn miễn phí', 'Phí thấp', 'Tăng ca nhiều', 'Xuất cảnh nhanh', 'Bảo lãnh gia đình', 'Lương cao'];
const SALARY = [
  { key: 'all', label: 'Tất cả mức lương', min: 0, max: Infinity },
  { key: 'lt180', label: 'Dưới 180.000 ¥', min: 0, max: 179999 },
  { key: '180', label: '180.000 – 200.000 ¥', min: 180000, max: 200000 },
  { key: '200', label: '200.000 – 250.000 ¥', min: 200001, max: 250000 },
  { key: 'gt250', label: 'Trên 250.000 ¥', min: 250001, max: Infinity },
] as const;
type SalaryKey = (typeof SALARY)[number]['key'];
type Gender = 'all' | 'nam' | 'nu';

/** Số ngành hiện sẵn ở cột lọc; còn lại bấm "Xem thêm" */
const INDUSTRY_PREVIEW = 6;
/** Bộ lọc nâng cao: lương cơ bản tối thiểu, dự kiến xuất cảnh (tháng) */
const SALARY_FROM = [170000, 190000, 210000, 250000];
const DEPARTURE: Array<{ value: DepartureWithin; label: string }> = [
  { value: '3', label: 'Trong 3 tháng' },
  { value: '6', label: 'Trong 6 tháng' },
  { value: '12', label: 'Trong 12 tháng' },
];
const PREF_OPTIONS = ['Tokyo', 'Osaka', 'Aichi', 'Saitama', 'Kanagawa', 'Chiba', 'Hokkaido', 'Fukuoka'];
const YEARS = Array.from({ length: 2007 - 1980 + 1 }, (_, i) => 2007 - i);

const PER_PAGE = 20;

type Toggles<K extends string> = Partial<Record<K, boolean>>;

/** Tablet / mobile: bộ lọc thành panel trượt */
const COMPACT_MQ = '(max-width: 1024px)';
function useCompact() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(COMPACT_MQ);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(COMPACT_MQ).matches,
    () => false,
  );
}
/** Từ khoá gợi ý dưới ô tìm kiếm */
const POPULAR_SEARCHES = ['Kaigo Osaka', 'Xây dựng Aichi', 'Điện tử nữ', 'Kỹ sư IT Tokyo'];

export default function SearchView({ breadcrumb }: { breadcrumb: ReactNode }) {
  const [advOpen, setAdvOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const compact = useCompact();
  const filtersCloseRef = useRef<HTMLButtonElement>(null);
  const [progSel, setProgSel] = useState<Toggles<Program>>({});
  const [regionSel, setRegionSel] = useState<Toggles<RegionKey>>({});
  const [feats, setFeats] = useState<Toggles<JobTag>>({});
  const [industrySel, setIndustrySel] = useState<Toggles<Industry>>({});
  const [gender, setGender] = useState<Gender>('all');
  const [salary, setSalary] = useState<SalaryKey>('all');
  const [salaryFrom, setSalaryFrom] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [departure, setDeparture] = useState<DepartureWithin | ''>('');
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [pref, setPref] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<Program | ''>('');
  const [sort, setSort] = useState<'relevance' | 'newest' | 'salary' | 'departure'>('relevance');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [posters, setPosters] = useState<Record<string, import('@/lib/types').Poster>>({});
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<JobFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const salRange = SALARY.find((s) => s.key === salary) ?? SALARY[0];
  const programKeys = useMemo(() => Object.keys(progSel).filter((key) => progSel[key as Program]).join(','), [progSel]);
  const regionKeys = useMemo(() => Object.keys(regionSel).filter((key) => regionSel[key as RegionKey]).join(','), [regionSel]);
  const tagKeys = useMemo(() => Object.keys(feats).filter((key) => feats[key as JobTag]).join(','), [feats]);
  const industryKeys = useMemo(() => Object.keys(industrySel).filter((key) => industrySel[key as Industry]).join(','), [industrySel]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q') ?? '';
    const initialPref = params.get('pref') ?? '';
    const initialProgram = params.get('prog') ?? '';
    setQueryDraft(initialQuery);
    setQuery(initialQuery);
    setPref(initialPref);
    if (PROGRAMS.includes(initialProgram as Program)) setSelectedProgram(initialProgram as Program);
  }, []);

  useEffect(() => {
    // Chờ khôi phục phiên đăng nhập để API trả đúng cờ "đã lưu"
    if (authLoading) return;
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), sort });
    const programs = [...new Set([...(selectedProgram ? [selectedProgram] : []), ...programKeys.split(',').filter(Boolean)])];
    if (query) params.set('q', query);
    if (pref) params.set('pref', pref);
    if (programs.length) params.set('program', programs.join(','));
    if (regionKeys) params.set('region', regionKeys);
    if (tagKeys) params.set('tag', tagKeys);
    if (industryKeys) params.set('industry', industryKeys);
    if (gender !== 'all') params.set('gender', gender);
    const salaryMin = Math.max(salary !== 'all' ? salRange.min : 0, Number(salaryFrom) || 0);
    if (salaryMin) params.set('salaryMin', String(salaryMin));
    if (salary !== 'all' && Number.isFinite(salRange.max)) params.set('salaryMax', String(salRange.max));
    if (birthYear) params.set('birthYear', birthYear);
    if (departure) params.set('departureWithin', departure);
    setLoading(true);
    setLoadError('');
    void apiRequest<Paginated<JobListItem>>(`/jobs?${params.toString()}`)
      .then((result) => {
        if (!active) return;
        setJobs(result.items.map(apiJobToView));
        setPosters(Object.fromEntries(result.items.map((item) => [item.recruiter.id, apiRecruiterToPoster(item)])));
        setTotal(result.total);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(apiMessage(error, 'Không thể tải danh sách việc làm.'));
        setJobs([]);
        setTotal(0);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, pref, selectedProgram, programKeys, regionKeys, tagKeys, industryKeys, gender, salary, salRange, salaryFrom, birthYear, departure, sort, authLoading, user?.id]);

  useEffect(() => {
    void apiRequest<JobFacets>('/jobs/facets').then(setFacets).catch(() => setFacets(null));
  }, []);

  // Panel bộ lọc (tablet/mobile): khoá cuộn trang, Esc để đóng, tự đóng khi về desktop
  useEffect(() => {
    if (!filtersOpen) return;
    if (!compact) {
      setFiltersOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFiltersOpen(false);
    document.documentElement.classList.add('is-sheet-open');
    document.addEventListener('keydown', onKey);
    filtersCloseRef.current?.focus();
    return () => {
      document.documentElement.classList.remove('is-sheet-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen, compact]);

  const matched = jobs;
  // Ngành theo số đơn đang tuyển (chưa có số liệu thì liệt kê đủ danh sách, không hiện số)
  const industryOptions: Array<{ industry: Industry; count: number | null }> = facets
    ? [...facets.industries, ...INDUSTRIES.filter((i) => !facets.industries.some((f) => f.industry === i)).map((industry) => ({ industry, count: 0 }))]
    : INDUSTRIES.map((industry) => ({ industry, count: null }));
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, pageCount);
  const from = total ? (current - 1) * PER_PAGE + 1 : 0;
  const to = Math.min(total, current * PER_PAGE);

  function toggle<K extends string>(setter: (fn: (o: Toggles<K>) => Toggles<K>) => void, key: K) {
    setter((o) => ({ ...o, [key]: !o[key] }));
    setPage(1);
  }

  const clearAll = () => {
    setProgSel({});
    setRegionSel({});
    setFeats({});
    setIndustrySel({});
    setGender('all');
    setSalary('all');
    setSalaryFrom('');
    setBirthYear('');
    setDeparture('');
    setQuery('');
    setQueryDraft('');
    setPref('');
    setSelectedProgram('');
    setSort('relevance');
    setPage(1);
  };

  // Chip bộ lọc đang áp dụng
  const chips: Array<{ label: string; remove: () => void }> = [
    ...PROGRAMS.filter((k) => progSel[k]).map((k) => ({ label: PROGRAM_LABEL[k], remove: () => toggle(setProgSel, k) })),
    ...REGIONS.filter((k) => regionSel[k]).map((k) => ({ label: REGION_LABEL[k], remove: () => toggle(setRegionSel, k) })),
    ...(gender !== 'all' ? [{ label: gender === 'nam' ? 'Tuyển nam' : 'Tuyển nữ', remove: () => setGender('all') }] : []),
    ...(salary !== 'all' ? [{ label: salRange.label, remove: () => setSalary('all') }] : []),
    ...(salaryFrom ? [{ label: `Lương từ ${formatNumber(Number(salaryFrom))} ¥`, remove: () => setSalaryFrom('') }] : []),
    ...(birthYear ? [{ label: `Sinh năm ${birthYear}`, remove: () => setBirthYear('') }] : []),
    ...(departure ? [{ label: `Xuất cảnh ${DEPARTURE.find((d) => d.value === departure)!.label.toLowerCase()}`, remove: () => setDeparture('') }] : []),
    ...FEATURES.filter((f) => feats[f]).map((f) => ({ label: f, remove: () => toggle(setFeats, f) })),
    ...Object.keys(industrySel).filter((key) => industrySel[key as Industry]).map((key) => ({ label: key, remove: () => toggle(setIndustrySel, key as Industry) })),
  ];

  const consultCta = (className: string) => (
    <div className={cx('consult-cta', className)}>
      <span className="consult-cta__bubble" />
      <span className="consult-cta__title">Chưa tìm thấy đơn phù hợp?</span>
      <span className="consult-cta__desc">Để lại thông tin, cán bộ tư vấn sẽ gợi ý đơn đúng tuổi, đúng ngành cho bạn.</span>
      <Link href="#" className="btn btn--white consult-cta__btn">
        Nhờ tư vấn miễn phí
      </Link>
    </div>
  );

  // Phân trang: 1 2 3 4 5 … N
  let pages: Array<number | 'gap'>;
  if (pageCount <= 7) pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  else if (current <= 4) pages = [1, 2, 3, 4, 5, 'gap', pageCount];
  else if (current >= pageCount - 3) pages = [1, 'gap', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  else pages = [1, 'gap', current - 1, current, current + 1, 'gap', pageCount];

  return (
    <>
      {/* FORM TÌM KIẾM MỞ RỘNG */}
      <section className="search-top">
        <span className="search-top__blob" />
        <div className="container search-top__inner">
          {breadcrumb}

          <div className="search-panel">
            <form role="search" className="search-bar" onSubmit={(e) => { e.preventDefault(); setQuery(queryDraft.trim()); setPage(1); }}>
              <label className="search-bar__field search-bar__field--grow">
                <IconSearch size={20} />
                <input type="text" aria-label="Từ khóa" placeholder="Ngành nghề, vị trí, xí nghiệp, mã đơn…" className="search-bar__input search-bar__input--lg" value={queryDraft} onChange={(e) => setQueryDraft(e.target.value)} />
              </label>
              <label className="search-bar__field">
                <IconPin size={18} />
                <Select aria-label="Tỉnh thành" className="search-bar__input" options={[{ value: '', label: 'Tất cả tỉnh thành' }, ...PREF_OPTIONS]} value={pref} onChange={(value) => { setPref(value); setPage(1); }} />
              </label>
              <label className="search-bar__field">
                <IconBriefcase size={18} />
                <Select aria-label="Chương trình" className="search-bar__input" options={[{ value: '', label: 'Tất cả chương trình' }, ...PROGRAMS.map((p) => ({ value: p, label: PROGRAM_LABEL[p] }))]} value={selectedProgram} onChange={(value) => { setSelectedProgram(value as Program | ''); setPage(1); }} />
              </label>
              <button type="submit" className="btn btn--primary search-bar__btn">
                <IconSearch size={18} className="icon--w22" />
                Tìm kiếm
              </button>
            </form>

            {advOpen && (
              <div className="search-adv">
                <div className="search-adv__grid">
                  <label className="search-adv__field">
                    Ngành nghề
                    <Select
                      className="field-input field-input--select"
                      aria-label="Ngành nghề"
                      options={[{ value: '', label: 'Tất cả ngành' }, ...INDUSTRIES]}
                      value={industryKeys.includes(',') ? '' : industryKeys}
                      onChange={(value) => { setIndustrySel(value ? { [value as Industry]: true } : {}); setPage(1); }}
                    />
                  </label>
                  <label className="search-adv__field">
                    Giới tính
                    <Select
                      className="field-input field-input--select"
                      aria-label="Giới tính"
                      options={[{ value: 'all', label: 'Nam và nữ' }, { value: 'nam', label: 'Tuyển nam' }, { value: 'nu', label: 'Tuyển nữ' }]}
                      value={gender}
                      onChange={(value) => { setGender(value as Gender); setPage(1); }}
                    />
                  </label>
                  <label className="search-adv__field">
                    Năm sinh của bạn
                    <Select
                      className="field-input field-input--select"
                      aria-label="Năm sinh của bạn"
                      options={[{ value: '', label: 'Không giới hạn' }, ...YEARS.map(String)]}
                      value={birthYear}
                      onChange={(value) => { setBirthYear(value); setPage(1); }}
                    />
                  </label>
                  <label className="search-adv__field">
                    Lương cơ bản từ
                    <Select
                      className="field-input field-input--select"
                      aria-label="Lương cơ bản từ"
                      options={[{ value: '', label: 'Mọi mức lương' }, ...SALARY_FROM.map((v) => ({ value: String(v), label: `Từ ${formatNumber(v)} ¥` }))]}
                      value={salaryFrom}
                      onChange={(value) => { setSalaryFrom(value); setPage(1); }}
                    />
                  </label>
                  <label className="search-adv__field">
                    Dự kiến xuất cảnh
                    <Select
                      className="field-input field-input--select"
                      aria-label="Dự kiến xuất cảnh"
                      options={[{ value: '', label: 'Bất kỳ' }, ...DEPARTURE]}
                      value={departure}
                      onChange={(value) => { setDeparture(value as DepartureWithin | ''); setPage(1); }}
                    />
                  </label>
                </div>
                <div className="search-adv__features">
                  <span className="search-adv__label">Đặc điểm đơn:</span>
                  {FEATURES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={!!feats[f]}
                      className={cx('feature-chip', feats[f] && 'feature-chip--active')}
                      onClick={() => toggle(setFeats, f)}
                    >
                      {feats[f] && <IconCheck size={12} className="icon--w3" />}
                      <span>{f}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="search-panel__foot">
              <button type="button" className="adv-toggle" aria-expanded={advOpen} onClick={() => setAdvOpen((v) => !v)}>
                <IconSliders size={16} className="icon--w2" />
                <span>{advOpen ? 'Thu gọn tùy chọn nâng cao' : 'Tùy chọn nâng cao'}</span>
              </button>
              <div className="popular-searches">
                <span>Tìm nhiều:</span>
                {POPULAR_SEARCHES.map((q) => (
                  <Link
                    key={q}
                    href={`/tim-kiem?q=${encodeURIComponent(q)}`}
                    onClick={() => {
                      setQueryDraft(q);
                      setQuery(q);
                      setPage(1);
                    }}
                  >
                    {q}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KẾT QUẢ */}
      <main className="search-main page-main">
        <div className="container search-main__inner">
          {/* SIDEBAR FILTER */}
          <aside
            id="search-filters"
            className={cx('filters', filtersOpen && 'filters--open')}
            aria-label="Bộ lọc"
            role={compact ? 'dialog' : undefined}
            aria-modal={compact && filtersOpen ? true : undefined}
          >
            <div className="filters__backdrop" aria-hidden="true" onClick={() => setFiltersOpen(false)} />
            <div className="filter-box">
              <div className="filter-box__head">
                <span className="filter-box__title">
                  <IconFilter size={18} />
                  Bộ lọc
                  {chips.length > 0 && <span className="filter-box__count">{chips.length}</span>}
                </span>
                {chips.length > 0 && (
                  <button type="button" className="link-btn filter-box__clear" onClick={clearAll}>
                    Xóa tất cả
                  </button>
                )}
                <button ref={filtersCloseRef} type="button" className="filters__close" aria-label="Đóng bộ lọc" onClick={() => setFiltersOpen(false)}>
                  <IconClose size={20} className="icon--w2" />
                </button>
              </div>

              {/* Bộ lọc đang áp dụng – bấm ✕ để bỏ từng điều kiện */}
              {chips.length > 0 && (
                <div className="filter-box__active" aria-label="Bộ lọc đang áp dụng">
                  <div className="filter-box__active-list">
                    {chips.map((c) => (
                      <button key={c.label} type="button" className="active-filter" aria-label={`Bỏ lọc ${c.label}`} onClick={c.remove}>
                        <span>{c.label}</span>
                        <IconCloseSmall size={14} className="icon--w22" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="filter-box__body">
                <div className="filter-group">
                  <span className="filter-group__title">Chương trình</span>
                  {PROGRAMS.map((k) => (
                    <label key={k} className="filter-option">
                      <input type="checkbox" className="filter-option__box" checked={!!progSel[k]} onChange={() => toggle(setProgSel, k)} />
                      <span className="filter-option__label">{PROGRAM_LABEL[k]}</span>
                      <span className="filter-option__count">{formatNumber(facets?.programs[k] ?? 0)}</span>
                    </label>
                  ))}
                </div>

                <div className="filter-group">
                  <span className="filter-group__title">Khu vực Nhật Bản</span>
                  {REGIONS.map((k) => (
                    <label key={k} className="filter-option">
                      <input type="checkbox" className="filter-option__box" checked={!!regionSel[k]} onChange={() => toggle(setRegionSel, k)} />
                      <span className="filter-option__label">{REGION_LABEL[k]}</span>
                      <span className="filter-option__count">{formatNumber(facets?.regions[k] ?? 0)}</span>
                    </label>
                  ))}
                </div>

                <div className="filter-group filter-group--gap">
                  <span className="filter-group__title">Giới tính</span>
                  <div className="segmented-3" role="radiogroup" aria-label="Giới tính">
                    {(
                      [
                        ['all', 'Tất cả'],
                        ['nam', 'Nam'],
                        ['nu', 'Nữ'],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={gender === k}
                        className={cx('segmented-3__option', gender === k && 'segmented-3__option--active')}
                        onClick={() => {
                          setGender(k);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-group__title">Lương cơ bản / tháng</span>
                  {SALARY.map((s) => (
                    <label key={s.key} className="filter-option">
                      <input
                        type="radio"
                        name="salary"
                        className="filter-option__box"
                        checked={salary === s.key}
                        onChange={() => {
                          setSalary(s.key);
                          setPage(1);
                        }}
                      />
                      <span className="filter-option__label">{s.label}</span>
                    </label>
                  ))}
                </div>

                <div className="filter-group filter-group--last">
                  <span className="filter-group__title">Ngành nghề</span>
                  {industryOptions.slice(0, showAllIndustries ? undefined : INDUSTRY_PREVIEW).map(({ industry, count }) => (
                    <label key={industry} className="filter-option">
                      <input type="checkbox" className="filter-option__box" checked={!!industrySel[industry]} onChange={() => toggle(setIndustrySel, industry)} />
                      <span className="filter-option__label">{industry}</span>
                      {count !== null && <span className="filter-option__count">{formatNumber(count)}</span>}
                    </label>
                  ))}
                  {industryOptions.length > INDUSTRY_PREVIEW && (
                    <button type="button" className="filter-group__more" onClick={() => setShowAllIndustries((v) => !v)}>
                      {showAllIndustries ? 'Thu gọn' : `+ Xem thêm ${industryOptions.length - INDUSTRY_PREVIEW} ngành`}
                    </button>
                  )}
                </div>
              </div>

              {/* Chân panel (tablet/mobile) */}
              <div className="filters__foot">
                {chips.length > 0 && (
                  <button type="button" className="btn btn--outline btn--lg" onClick={clearAll}>
                    Xóa lọc
                  </button>
                )}
                <button type="button" className="btn btn--primary btn--lg filters__apply" onClick={() => setFiltersOpen(false)}>
                  Xem {formatNumber(total)} đơn
                </button>
              </div>
            </div>

            {consultCta('consult-cta--aside')}
          </aside>

          {/* DANH SÁCH */}
          <div className="results">
            <div className="results-bar">
              <div className="results-bar__row">
                <span className="results-bar__total">
                  Tìm thấy <b>{formatNumber(total)}</b> đơn hàng phù hợp
                </span>
                <div className="results-bar__actions">
                  <button
                    type="button"
                    className="filters-trigger"
                    aria-haspopup="dialog"
                    aria-expanded={filtersOpen}
                    aria-controls="search-filters"
                    onClick={() => setFiltersOpen(true)}
                  >
                    <IconSliders size={17} className="icon--w2" />
                    Bộ lọc
                    {chips.length > 0 && <span className="filters-trigger__count">{chips.length}</span>}
                  </button>
                  <label className="sort-select">
                    Sắp xếp
                    <Select
                      className="field-input field-input--select sort-select__control"
                      aria-label="Sắp xếp"
                      options={['Phù hợp nhất', 'Mới nhất', 'Lương cao nhất', 'Xuất cảnh sớm nhất']}
                      value={{ relevance: 'Phù hợp nhất', newest: 'Mới nhất', salary: 'Lương cao nhất', departure: 'Xuất cảnh sớm nhất' }[sort]}
                      onChange={(value) => {
                        const next = { 'Phù hợp nhất': 'relevance', 'Mới nhất': 'newest', 'Lương cao nhất': 'salary', 'Xuất cảnh sớm nhất': 'departure' }[value];
                        if (next) { setSort(next as typeof sort); setPage(1); }
                      }}
                    />
                  </label>
                </div>
              </div>
              {chips.length > 0 && (
                <div className="active-filters">
                  {chips.map((c) => (
                    <button key={c.label} type="button" className="active-filter" aria-label={`Bỏ lọc ${c.label}`} onClick={c.remove}>
                      <span>{c.label}</span>
                      <IconCloseSmall size={14} className="icon--w22" />
                    </button>
                  ))}
                  <button type="button" className="link-btn link-btn--muted" onClick={clearAll}>
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </div>

            {loadError ? (
              <div className="results-empty" role="alert"><span className="results-empty__title">Không thể tải việc làm</span><span className="results-empty__desc">{loadError}</span></div>
            ) : loading && matched.length === 0 ? (
              <div className="results-empty" role="status"><span className="results-empty__title">Đang tải việc làm…</span></div>
            ) : matched.length === 0 && (
              <div className="results-empty">
                <span className="results-empty__icon">
                  <IconSearch size={26} />
                </span>
                <span className="results-empty__title">Chưa có đơn khớp bộ lọc</span>
                <span className="results-empty__desc">Thử bỏ bớt điều kiện hoặc nhờ cán bộ tư vấn gợi ý đơn phù hợp.</span>
                <button type="button" className="btn btn--primary results-empty__btn" onClick={clearAll}>
                  Xóa bộ lọc
                </button>
              </div>
            )}

            <div className="job-list">
              {matched.map((job) => (
                <JobCard key={job.id} job={job} poster={posters[job.posterId]} applyJob={toApplyJob(job, undefined, posters[job.posterId])} />
              ))}
            </div>

            <nav className="pagination" aria-label="Phân trang">
              <span className="pagination__info">
                Hiển thị <b>{`${formatNumber(from)} – ${formatNumber(to)}`}</b> trên {formatNumber(total)} đơn
              </span>
              <div className="pagination__pages">
                <button type="button" className="page-btn" aria-label="Trang trước" disabled={current === 1} onClick={() => setPage(Math.max(1, current - 1))}>
                  <IconChevronLeft size={16} className="icon--w22" />
                </button>
                {pages.map((p, i) =>
                  p === 'gap' ? (
                    <span key={`gap-${i}`} className="pagination__gap">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={cx('page-btn', p === current && 'page-btn--active')}
                      aria-label={`Trang ${p}`}
                      aria-current={p === current ? 'page' : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <span className="pagination__compact" aria-hidden="true">
                  Trang <b>{current}</b> / {formatNumber(pageCount)}
                </span>
                <button type="button" className="page-btn" aria-label="Trang sau" disabled={current === pageCount} onClick={() => setPage(Math.min(pageCount, current + 1))}>
                  <IconChevronRight size={16} className="icon--w22" />
                </button>
              </div>
            </nav>

            {consultCta('consult-cta--inline')}
          </div>
        </div>
      </main>
    </>
  );
}
