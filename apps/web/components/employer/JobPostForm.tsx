'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  INDUSTRIES,
  JOB_BENEFITS,
  JOB_STATUS_LABEL,
  PREFECTURES,
  estimateNetIncome,
  yenToMillionVnd,
  type EmployerJobForm,
  type EmployerJobList,
  type Industry,
  type JobChannel,
  type JobDetail,
  type JobGender,
  type JobMarketInsight,
  type JlptLevel,
  type Program,
  type ScreeningKind,
  type TeamMember,
} from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { CheckCard, Field, FormSection, OptionGroup, toggleIn } from '@/components/form/FormKit';
import Select from '@/components/ui/Select';
import { IconCheck, IconCloseSmall, IconEye, IconMinus, IconPhone, IconPlus, IconSave, IconSend, IconSparkle, IconUpload, IconUser } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, hourMinute } from '@/lib/employer';
import { cx, formatNumber } from '@/lib/format';
import { EMPTY_DRAFT, completionOf, qualityOf, stepsOf, titleChecks, validateDraft, type JobPostDraft } from '@/lib/job-post';
import { uploadAsset } from '@/lib/upload';
import './job-post.css';

const DRAFT_KEY = 'vp:job-post-draft';
const YEAR = new Date().getFullYear();
const PROGRAM_OPTIONS: Array<{ value: Program; label: string }> = [
  { value: 'tts', label: 'Thực tập sinh kỹ năng' },
  { value: 'tok', label: 'Kỹ năng đặc định' },
  { value: 'ks', label: 'Kỹ sư – Tri thức' },
];
const GENDER_OPTIONS: Array<{ value: JobGender; label: string }> = [
  { value: 'nu', label: 'Nữ' },
  { value: 'nam', label: 'Nam' },
  { value: 'both', label: 'Không yêu cầu' },
];
const JLPT_OPTIONS: Array<{ value: JlptLevel | 'none'; label: string }> = [
  { value: 'none', label: 'Không yêu cầu' },
  { value: 'N5', label: 'N5' },
  { value: 'N4', label: 'N4' },
  { value: 'N3', label: 'N3 trở lên' },
];
const CONTRACT_OPTIONS = [
  { value: '1', label: '1 năm' },
  { value: '3', label: '3 năm' },
  { value: '5', label: '5 năm' },
] as const;
const OVERTIME_OPTIONS = [0, 10, 20, 30, 40, 45].map((h) => ({ value: String(h), label: h ? `~ ${h} giờ / tháng` : 'Không làm thêm' }));
const CHANNEL_LABEL: Record<JobChannel, string> = { viecpro: 'Nút ứng tuyển viecpro', zalo: 'Zalo OA doanh nghiệp', hotline: 'Hiện số hotline' };
const REQUIREMENT_SUGGESTIONS = ['Có hộ chiếu', 'Không mù màu', 'Cao từ 150 cm', 'Khéo tay', 'Thị lực tốt', 'Không hình xăm'];
const SAMPLE_IMAGES = Array.from({ length: 20 }, (_, i) => `/images/jobs/job-${String(i + 1).padStart(2, '0')}.jpg`);
const VISIBILITY: Array<{ value: JobPostDraft['visibility']; title: string; desc: string; cost: string; tag?: string }> = [
  { value: 'standard', title: 'Tiêu chuẩn', desc: 'Hiển thị 30 ngày trong kết quả tìm kiếm.', cost: 'Có sẵn trong gói' },
  { value: 'featured', title: 'Nổi bật', desc: 'Gắn nhãn HOT, ưu tiên trong ngành 7 ngày.', cost: 'Dùng 5 lượt đẩy', tag: 'Đề xuất' },
  { value: 'urgent', title: 'Tuyển gấp', desc: 'Nhãn GẤP, nổi bật với ứng viên phù hợp.', cost: 'Dùng 10 lượt đẩy' },
];
const CRITERIA = [
  'Thông tin đơn hàng khớp với hợp đồng cung ứng đã đăng ký.',
  'Không thu phí ngoài các khoản đã công khai trong tin.',
  'Ảnh là ảnh thực tế, không chèn số điện thoại của cá nhân.',
  'Không phân biệt vùng miền, tôn giáo trong yêu cầu.',
];

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** URL hiển thị của ảnh tải lên trong phiên (đường dẫn kho → URL tuyệt đối do API trả về) */
const uploadedUrls = new Map<string, string>();
const srcOf = (path: string) => uploadedUrls.get(path) ?? path;

function fromForm(f: EmployerJobForm): JobPostDraft {
  const p = f.posting;
  return {
    ...EMPTY_DRAFT,
    title: f.title,
    program: f.program,
    industry: f.industry,
    position: f.position ?? '',
    pref: f.pref,
    quantity: f.quantity,
    examAt: dateInput(f.examAt),
    gallery: p?.gallery.length ? p.gallery : f.imageUrl.startsWith('/images/') || f.imageUrl.startsWith('uploads/') ? [f.imageUrl] : [],
    gender: f.gender,
    ageFrom: YEAR - f.birthYearTo,
    ageTo: YEAR - f.birthYearFrom,
    jlpt: (f.jlptRequired as JlptLevel | null) ?? '',
    educationMin: p?.educationMin ?? '',
    otherRequirements: p?.otherRequirements ?? [],
    description: p?.description ?? '',
    salary: f.salary,
    overtimeHours: p?.overtimeHours ?? 0,
    contractYears: f.contractYears ?? 3,
    feeUsd: f.feeUsd === null ? '' : String(f.feeUsd),
    benefits: p?.benefits ?? [],
    deadline: dateInput(f.deadline),
    departureAt: dateInput(f.departureAt),
    recruiterId: f.recruiterId,
    channels: p?.channels ?? ['viecpro'],
    screening: p?.screening ?? [],
    visibility: f.visibility,
  };
}

function toPayload(d: JobPostDraft, publish: boolean) {
  return {
    title: d.title.trim(),
    program: d.program || 'tts',
    industry: d.industry || 'Khác',
    position: d.position.trim() || undefined,
    pref: d.pref || 'Tokyo',
    quantity: d.quantity,
    salary: d.salary || 50000,
    gender: d.gender || 'both',
    birthYearFrom: YEAR - d.ageTo,
    birthYearTo: YEAR - d.ageFrom,
    jlptRequired: d.jlpt || null,
    contractYears: d.contractYears,
    feeUsd: d.feeUsd === '' ? undefined : Number(d.feeUsd),
    examAt: d.examAt || undefined,
    deadline: d.deadline || undefined,
    departureAt: d.departureAt || undefined,
    visibility: d.visibility,
    recruiterId: d.recruiterId || undefined,
    imageUrl: d.gallery[0],
    publish,
    posting: {
      description: d.description,
      otherRequirements: d.otherRequirements,
      educationMin: d.educationMin || undefined,
      overtimeHours: d.overtimeHours,
      benefits: d.benefits,
      channels: d.channels,
      screening: d.screening,
      gallery: d.gallery,
    },
  };
}

/** Tên trường lỗi API → trường trong form */
function mapFieldErrors(fields: Record<string, string> | undefined): Partial<Record<keyof JobPostDraft, string>> {
  const out: Partial<Record<keyof JobPostDraft, string>> = {};
  for (const [key, msg] of Object.entries(fields ?? {})) {
    const k = key.replace(/^posting\./, '').split('.')[0]!;
    const mapped = k === 'birthYearFrom' || k === 'birthYearTo' ? 'ageFrom' : k === 'jlptRequired' ? 'jlpt' : k === 'imageUrl' ? 'gallery' : k;
    if (mapped in EMPTY_DRAFT) out[mapped as keyof JobPostDraft] ??= msg;
  }
  return out;
}

/** Form đăng tin mới / sửa tin (design 15) */
export default function JobPostForm({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const { account, refresh } = useEmployerAccount();
  const [d, setD] = useState<JobPostDraft>(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(!jobId);
  const [current, setCurrent] = useState<EmployerJobForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof JobPostDraft, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'publish'>('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [market, setMarket] = useState<JobMarketInsight | null>(null);
  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop');
  const topRef = useRef<HTMLDivElement>(null);

  const set = useCallback(<K extends keyof JobPostDraft>(key: K, value: JobPostDraft[K]) => {
    setD((x) => ({ ...x, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  // Tải tin cần sửa / bản nháp tự lưu
  useEffect(() => {
    void apiRequest<TeamMember[]>('/employer/team').then(setTeam).catch(() => setTeam([]));
    if (jobId) {
      apiRequest<EmployerJobForm>(`/employer/jobs/${encodeURIComponent(jobId)}/form`)
        .then((f) => {
          setCurrent(f);
          setD(fromForm(f));
          setLoaded(true);
        })
        .catch((e: unknown) => {
          setFormError(apiMessage(e, 'Không tải được tin cần sửa.'));
          setLoaded(true);
        });
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { draft: JobPostDraft; at: string };
        setD({ ...EMPTY_DRAFT, ...saved.draft });
        setSavedAt(new Date(saved.at));
      }
    } catch {
      /* bộ nhớ trình duyệt không dùng được – bỏ qua */
    }
  }, [jobId]);

  // Mặc định cán bộ phụ trách = người đăng
  useEffect(() => {
    if (!d.recruiterId && team.length) set('recruiterId', team.find((m) => m.isMe)?.id ?? team[0]!.id);
  }, [team, d.recruiterId, set]);

  // Tự lưu nháp trong trình duyệt (tin mới) sau 1,5 giây không gõ
  useEffect(() => {
    if (jobId || !loaded || !d.title.trim()) return;
    const t = setTimeout(() => {
      try {
        const at = new Date();
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: d, at: at.toISOString() }));
        setSavedAt(at);
      } catch {
        /* bỏ qua */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [d, jobId, loaded]);

  // Khoảng lương thị trường + ước tính tiếp cận
  useEffect(() => {
    if (!d.industry || !d.program) return;
    const p = new URLSearchParams({ industry: d.industry, program: d.program, quantity: String(Math.max(1, d.quantity)) });
    if (d.pref) p.set('pref', d.pref);
    if (d.gender) p.set('gender', d.gender);
    p.set('birthYearFrom', String(YEAR - d.ageTo));
    p.set('birthYearTo', String(YEAR - d.ageFrom));
    const t = setTimeout(() => {
      apiRequest<JobMarketInsight>(`/employer/jobs/market?${p.toString()}`).then(setMarket).catch(() => setMarket(null));
    }, 400);
    return () => clearTimeout(t);
  }, [d.industry, d.program, d.pref, d.gender, d.ageFrom, d.ageTo, d.quantity]);

  const submit = async (publish: boolean) => {
    const found = validateDraft(d, publish);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) {
      setFormError('Vui lòng kiểm tra các trường được đánh dấu.');
      document.querySelector('.ef-field__error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(publish ? 'publish' : 'draft');
    try {
      const body = JSON.stringify(toPayload(d, publish));
      const job = jobId
        ? await apiRequest<JobDetail>(`/employer/jobs/${encodeURIComponent(jobId)}`, { method: 'PUT', body })
        : await apiRequest<JobDetail>('/employer/jobs', { method: 'POST', body });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* bỏ qua */
      }
      await refresh();
      router.push(`${EMPLOYER_BASE}/don-hang?tab=${job.status === 'draft' ? 'draft' : job.status === 'pending' ? 'pending' : 'visible'}`);
    } catch (e) {
      setFormError(apiMessage(e, 'Không lưu được tin.'));
      if (e instanceof ApiClientError) setErrors(mapFieldErrors(e.fields));
    } finally {
      setBusy('');
    }
  };

  const reuse = async (id: string) => {
    try {
      const f = await apiRequest<EmployerJobForm>(`/employer/jobs/${encodeURIComponent(id)}/form`);
      setD({ ...fromForm(f), deadline: '', examAt: '', visibility: 'standard' });
      setErrors({});
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setFormError(apiMessage(e, 'Không tải được tin cũ.'));
    }
  };

  const steps = stepsOf(d);
  const completion = completionOf(d);
  const quality = qualityOf(d);
  const verified = account.kind === 'company' ? !!account.company?.verified : account.cccdVerified;
  const boostsLeft = account.plan ? account.plan.boostQuota - account.plan.boostsUsed : 0;
  const primaryLabel = jobId ? 'Lưu & gửi duyệt' : verified ? 'Đăng tin' : 'Gửi duyệt tin';

  if (!loaded) return <p className="emp-state">Đang tải tin…</p>;

  return (
    <div className="jp" ref={topRef}>
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <Link href={`${EMPLOYER_BASE}/don-hang`}>Tin tuyển dụng</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">{jobId ? 'Sửa tin' : 'Đăng tin mới'}</span>
          </nav>
          <h1 className="emp-page-head__title">{jobId ? `Sửa tin ${current?.code ?? ''}` : 'Đăng tin mới'}</h1>
        </span>
        <span className="emp-page-head__actions">
          {savedAt && !jobId && (
            <span className="jp-saved">
              <IconCheck size={14} className="icon--w26" />
              Đã tự lưu nháp lúc {hourMinute(savedAt)}
            </span>
          )}
          {current && <span className={cx('emp-status', `emp-status--${current.status}`)}>{JOB_STATUS_LABEL[current.status]}</span>}
          <button type="button" className="emp-btn jp-head-btn" onClick={() => document.getElementById('jp-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <IconEye size={16} />
            Xem trước
          </button>
          <button type="button" className="emp-btn emp-btn--primary jp-head-btn" disabled={busy !== ''} onClick={() => void submit(true)}>
            <IconSend size={16} className="icon--w24" />
            {busy === 'publish' ? 'Đang gửi…' : primaryLabel}
          </button>
        </span>
      </div>

      <div className="jp-layout">
        <div className="jp-main">
          <div className="emp-card jp-steps">
            <ol className="jp-steps__list">
              {steps.map((s, i) => {
                const active = !s.done && steps.slice(0, i).every((x) => x.done);
                return (
                  <li key={s.key} className="jp-steps__item">
                    <a href={`#jp-${s.key}`} className="jp-steps__link">
                      <span className={cx('jp-steps__num', s.done && 'jp-steps__num--done', active && 'jp-steps__num--active')}>{s.done ? '✓' : i + 1}</span>
                      <span className="jp-steps__text">
                        <span className={cx('jp-steps__label', !s.done && !active && 'jp-steps__label--muted')}>{s.label}</span>
                        <span className={cx('jp-steps__state', s.done && 'jp-steps__state--done', active && 'jp-steps__state--active')}>{s.done ? 'Đã xong' : active ? 'Đang điền' : 'Chưa xong'}</span>
                      </span>
                    </a>
                    {i < steps.length - 1 && <span className={cx('jp-steps__line', s.done && 'jp-steps__line--done')} />}
                  </li>
                );
              })}
            </ol>
            <span className="jp-steps__sep" />
            <span className="jp-steps__progress">
              <span className="jp-steps__row">
                <span>Hoàn thiện</span>
                <b>{completion}%</b>
              </span>
              <span className="emp-bar">
                <span className="emp-bar__fill" style={{ width: `${completion}%` }} />
              </span>
            </span>
          </div>

          <BasicSection d={d} set={set} errors={errors} />
          <RequirementsSection d={d} set={set} errors={errors} />
          <SalarySection d={d} set={set} errors={errors} market={market} />
          <DisplaySection d={d} set={set} errors={errors} team={team} boostsLeft={boostsLeft} company={account.kind === 'company'} />

          <div className="ef-footer">
            <span className="ef-footer__note">
              {formError ? (
                <span className="ef-footer__error" role="alert">
                  {formError}
                </span>
              ) : (
                <>
                  <IconSparkle size={16} />
                  {verified ? 'Tài khoản đã xác minh – tin hiển thị ngay sau khi đăng' : 'Tin được kiểm duyệt trong 2 giờ làm việc'}
                  {account.plan ? ` · Còn ${boostsLeft} lượt đẩy tin trong ${account.plan.name}` : ''}
                </>
              )}
            </span>
            <button type="button" className="emp-btn" disabled={busy !== ''} onClick={() => void submit(false)}>
              <IconSave size={16} />
              {busy === 'draft' ? 'Đang lưu…' : 'Lưu nháp'}
            </button>
            <button type="button" className="emp-btn emp-btn--primary" disabled={busy !== ''} onClick={() => void submit(true)}>
              <IconSend size={16} className="icon--w24" />
              {busy === 'publish' ? 'Đang gửi…' : primaryLabel}
            </button>
          </div>
        </div>

        <aside className="jp-side">
          <Preview d={d} mode={preview} onMode={setPreview} companyName={account.company?.shortName ?? account.company?.name ?? account.user.name} logo={account.company?.logoUrl ?? account.user.avatarUrl} verified={verified} />
          <Quality quality={quality} />
          <Reach market={market} />
          {!jobId && <Reuse onPick={(id) => void reuse(id)} />}
          <div className="emp-card jp-card">
            <b className="jp-card__title">Tiêu chí kiểm duyệt</b>
            <ul className="jp-criteria">
              {CRITERIA.map((c) => (
                <li key={c}>
                  <IconCheck size={13} className="icon--w26" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="emp-card jp-help">
            <span className="jp-help__avatar">
              <IconUser size={18} />
            </span>
            <span className="jp-help__text">
              <b>Cần hỗ trợ đăng tin?</b>
              <span>Chuyên viên viecpro · 8:00 – 21:00</span>
            </span>
            <a href="tel:19006699" className="emp-btn emp-btn--md">
              <IconPhone size={14} />
              Gọi ngay
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

type SectionProps = {
  d: JobPostDraft;
  set: <K extends keyof JobPostDraft>(key: K, value: JobPostDraft[K]) => void;
  errors: Partial<Record<keyof JobPostDraft, string>>;
};

/* ---------- 1. Thông tin cơ bản ---------- */
function BasicSection({ d, set, errors }: SectionProps) {
  const [library, setLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const checks = titleChecks(d);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const { assetPath, assetUrl } = await uploadAsset(file, 'image');
      uploadedUrls.set(assetPath, assetUrl);
      set('gallery', [...d.gallery, assetPath].slice(0, 10));
    } catch (err) {
      setUploadError(`${apiMessage(err, err instanceof Error ? err.message : 'Không tải được ảnh.')} Bạn có thể chọn ảnh từ thư viện mẫu.`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <FormSection num={1} id="jp-basic" title="Thông tin cơ bản" desc="Tiêu đề rõ ràng giúp tin xuất hiện đúng khi người lao động tìm kiếm.">
      <Field label="Tiêu đề tin" required extra={`${d.title.length}/90`} error={errors.title} errorId="jp-title-error">
        <input
          className={cx('ef-input ef-input--strong', errors.title && 'ef-input--invalid')}
          value={d.title}
          maxLength={90}
          placeholder="VD: Tuyển 25 nữ lắp ráp linh kiện điện tử tại Saitama"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'jp-title-error' : undefined}
          onChange={(e) => set('title', e.target.value)}
        />
        <span className="jp-title-checks">
          {checks.map((c) => (
            <span key={c.key} className={cx('jp-title-check', !c.ok && 'jp-title-check--off')}>
              {c.ok ? <IconCheck size={13} className="icon--w26" /> : <IconPlus size={13} className="icon--w26" />}
              {c.label}
            </span>
          ))}
        </span>
      </Field>

      <Field label="Chương trình" required error={errors.program}>
        <OptionGroup label="Chương trình" options={PROGRAM_OPTIONS} value={d.program} onChange={(v) => set('program', v)} invalid={!!errors.program} />
      </Field>

      <div className="ef-grid">
        <Field label="Ngành nghề" required error={errors.industry}>
          <Select className={cx('field-input field-input--select ef-select', errors.industry && 'ef-input--invalid')} aria-label="Ngành nghề" placeholder="Chọn ngành nghề" value={d.industry} onChange={(v) => set('industry', v as Industry)} options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
        </Field>
        <Field label="Công việc cụ thể" hint="Hiển thị dạng “Lắp ráp điện tử – Saitama”">
          <input className="ef-input" value={d.position} maxLength={80} placeholder="VD: Lắp ráp bảng mạch, kiểm tra ngoại quan" onChange={(e) => set('position', e.target.value)} />
        </Field>
      </div>

      <div className="ef-grid ef-grid--3">
        <Field label="Nơi làm việc" required error={errors.pref}>
          <Select className={cx('field-input field-input--select ef-select', errors.pref && 'ef-input--invalid')} aria-label="Nơi làm việc" placeholder="Chọn tỉnh" value={d.pref} onChange={(v) => set('pref', v)} options={PREFECTURES.map((p) => ({ value: p, label: p }))} />
        </Field>
        <Field label="Số lượng tuyển" required error={errors.quantity}>
          <span className="ef-stepper">
            <button type="button" className="ef-stepper__btn" aria-label="Giảm" onClick={() => set('quantity', Math.max(1, d.quantity - 1))}>
              <IconMinus size={16} className="icon--w22" />
            </button>
            <input className="ef-stepper__input" inputMode="numeric" aria-label="Số lượng tuyển" value={`${d.quantity} người`} onChange={(e) => set('quantity', Math.min(500, Number(e.target.value.replace(/\D/g, '')) || 0))} />
            <button type="button" className="ef-stepper__btn" aria-label="Tăng" onClick={() => set('quantity', Math.min(500, d.quantity + 1))}>
              <IconPlus size={16} className="icon--w22" />
            </button>
          </span>
        </Field>
        <Field label="Ngày thi tuyển">
          <input type="date" className="ef-input" value={d.examAt} onChange={(e) => set('examAt', e.target.value)} />
        </Field>
      </div>

      <Field label="Ảnh & video môi trường làm việc" hint={uploadError ? undefined : 'Tin có từ 3 ảnh thực tế nhận nhiều hồ sơ hơn 1,8 lần. Tối đa 10 ảnh.'} error={uploadError || errors.gallery}>
        <div className="jp-gallery">
          {d.gallery.map((src, i) => (
            <span key={src} className="jp-gallery__item">
              <img src={srcOf(src)} alt="" />
              {i === 0 && <span className="jp-gallery__cover">ẢNH BÌA</span>}
              <button type="button" className="jp-gallery__remove" aria-label="Bỏ ảnh" onClick={() => set('gallery', d.gallery.filter((x) => x !== src))}>
                <IconCloseSmall size={14} className="icon--w26" />
              </button>
            </span>
          ))}
          {d.gallery.length < 10 && (
            <span className="jp-gallery__add">
              <label className="jp-gallery__upload">
                <IconUpload size={18} />
                {uploading ? 'Đang tải…' : 'Tải ảnh lên'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={uploading} onChange={(e) => void upload(e)} />
              </label>
              <button type="button" className="emp-link-btn" onClick={() => setLibrary((v) => !v)}>
                {library ? 'Đóng thư viện' : 'Chọn ảnh mẫu'}
              </button>
            </span>
          )}
        </div>
        {library && (
          <div className="jp-library" role="listbox" aria-label="Thư viện ảnh mẫu" aria-multiselectable="true">
            {SAMPLE_IMAGES.map((src) => {
              const on = d.gallery.includes(src);
              return (
                <button key={src} type="button" role="option" aria-selected={on} className={cx('jp-library__item', on && 'jp-library__item--on')} onClick={() => set('gallery', on ? d.gallery.filter((x) => x !== src) : [...d.gallery, src].slice(0, 10))}>
                  <img src={src} alt="" loading="lazy" />
                  {on && <IconCheck size={14} className="icon--w3" />}
                </button>
              );
            })}
          </div>
        )}
      </Field>
    </FormSection>
  );
}

/* ---------- 2. Yêu cầu ứng viên ---------- */
function RequirementsSection({ d, set, errors }: SectionProps) {
  const [tag, setTag] = useState('');
  const addTag = (value: string) => {
    const v = value.trim();
    if (v && !d.otherRequirements.includes(v) && d.otherRequirements.length < 10) set('otherRequirements', [...d.otherRequirements, v.slice(0, 40)]);
    setTag('');
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tag);
    } else if (e.key === 'Backspace' && !tag && d.otherRequirements.length) {
      set('otherRequirements', d.otherRequirements.slice(0, -1));
    }
  };
  return (
    <FormSection num={2} id="jp-requirements" title="Yêu cầu ứng viên" desc="Hệ thống dùng các tiêu chí này để chấm % phù hợp cho từng hồ sơ.">
      <div className="ef-grid">
        <Field label="Giới tính" required error={errors.gender}>
          <OptionGroup label="Giới tính" options={GENDER_OPTIONS} value={d.gender} onChange={(v) => set('gender', v)} invalid={!!errors.gender} />
        </Field>
        <Field label="Độ tuổi" required error={errors.ageFrom} hint="Tính theo năm sinh của người lao động">
          <span className="jp-range">
            <input className={cx('ef-input jp-range__input', errors.ageFrom && 'ef-input--invalid')} inputMode="numeric" aria-label="Tuổi từ" value={d.ageFrom || ''} onChange={(e) => set('ageFrom', Number(e.target.value.replace(/\D/g, '')) || 0)} />
            <span className="jp-range__dash">–</span>
            <input className={cx('ef-input jp-range__input', errors.ageFrom && 'ef-input--invalid')} inputMode="numeric" aria-label="Tuổi đến" value={d.ageTo || ''} onChange={(e) => set('ageTo', Number(e.target.value.replace(/\D/g, '')) || 0)} />
          </span>
        </Field>
        <Field label="Tiếng Nhật">
          <OptionGroup label="Tiếng Nhật" options={JLPT_OPTIONS} value={d.jlpt || 'none'} onChange={(v) => set('jlpt', v === 'none' ? '' : v)} size="sm" />
        </Field>
        <Field label="Học vấn tối thiểu">
          <Select className="field-input field-input--select ef-select" aria-label="Học vấn tối thiểu" value={d.educationMin} onChange={(v) => set('educationMin', v as JobPostDraft['educationMin'])} options={[{ value: '', label: 'Không yêu cầu' }, ...EDUCATION_LEVELS.map((e) => ({ value: e, label: EDUCATION_LABEL[e] }))]} />
        </Field>
      </div>

      <Field label="Yêu cầu khác">
        <span className="ef-tags">
          {d.otherRequirements.map((r) => (
            <span key={r} className="ef-tag">
              {r}
              <button type="button" className="ef-tag__remove" aria-label={`Bỏ ${r}`} onClick={() => set('otherRequirements', d.otherRequirements.filter((x) => x !== r))}>
                <IconCloseSmall size={12} className="icon--w26" />
              </button>
            </span>
          ))}
          <input className="ef-tags__input" value={tag} maxLength={40} placeholder="Nhập yêu cầu rồi nhấn Enter…" aria-label="Thêm yêu cầu khác" onChange={(e) => setTag(e.target.value)} onKeyDown={onTagKey} onBlur={() => tag && addTag(tag)} />
        </span>
        <span className="ef-suggest">
          Gợi ý:
          {REQUIREMENT_SUGGESTIONS.filter((s) => !d.otherRequirements.includes(s)).map((s) => (
            <button key={s} type="button" className="ef-suggest__btn" onClick={() => addTag(s)}>
              + {s}
            </button>
          ))}
        </span>
      </Field>

      <Field label="Mô tả công việc" required error={errors.description} hint="Mỗi dòng một ý – hiển thị dạng gạch đầu dòng trên trang tin" extra={`${d.description.length}/3000`}>
        <textarea
          className={cx('ef-input jp-description', errors.description && 'ef-input--invalid')}
          value={d.description}
          maxLength={3000}
          rows={5}
          placeholder={'• Lắp ráp linh kiện điện tử, bảng mạch cho thiết bị gia dụng\n• Kiểm tra ngoại quan sản phẩm bằng kính lúp\n• Làm việc trong nhà xưởng có điều hoà, ca ngày 8:00 – 17:00'}
          aria-invalid={!!errors.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>
    </FormSection>
  );
}

/* ---------- 3. Lương & phúc lợi ---------- */
function SalarySection({ d, set, errors, market }: SectionProps & { market: JobMarketInsight | null }) {
  const m = market?.salary;
  const pos = m && m.max > m.min ? Math.min(100, Math.max(0, ((d.salary - m.min) / (m.max - m.min)) * 100)) : 50;
  return (
    <FormSection num={3} id="jp-salary" title="Lương & phúc lợi" desc="Tin ghi rõ lương và chi phí xuất cảnh được người lao động tin tưởng hơn.">
      <div className="ef-grid">
        <Field label="Lương cơ bản / tháng" required error={errors.salary} extra={d.salary ? `≈ ${formatNumber(yenToMillionVnd(d.salary))} triệu VNĐ` : undefined}>
          <span className="ef-affix">
            <input className={cx('ef-input ef-input--strong', errors.salary && 'ef-input--invalid')} inputMode="numeric" value={d.salary ? formatNumber(d.salary) : ''} placeholder="VD: 190.000" aria-invalid={!!errors.salary} onChange={(e) => set('salary', Math.min(1_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))} />
            <span className="ef-affix__unit">¥</span>
          </span>
        </Field>
        <Field label="Thực lĩnh ước tính" extra="sau thuế, BH, nhà ở">
          <input className="ef-input" readOnly value={d.salary ? `≈ ${formatNumber(estimateNetIncome(d.salary))} ¥` : '—'} aria-label="Thực lĩnh ước tính" />
        </Field>
      </div>

      {m && (
        <div className="jp-market">
          <span className="jp-market__head">
            <span>
              Lương đơn {d.industry ? d.industry.toLowerCase() : ''}
              {d.pref ? ` tại ${d.pref}` : ''}: {formatNumber(m.min)} – {formatNumber(m.max)} ¥
            </span>
            {d.salary > 0 && <span className={cx('jp-market__chip', d.salary < m.median && 'jp-market__chip--low')}>{d.salary >= m.median ? 'Cạnh tranh' : 'Thấp hơn trung vị'}</span>}
          </span>
          <span className="jp-market__track">
            {d.salary > 0 && <span className="jp-market__dot" style={{ left: `${pos}%` }} />}
          </span>
          <span className="jp-market__scale">
            <span>{formatNumber(m.min)} ¥</span>
            <span>Trung vị {formatNumber(m.median)} ¥</span>
            <span>{formatNumber(m.max)} ¥</span>
          </span>
        </div>
      )}

      <div className="ef-grid ef-grid--3">
        <Field label="Làm thêm">
          <Select className="field-input field-input--select ef-select" aria-label="Làm thêm" value={String(d.overtimeHours)} onChange={(v) => set('overtimeHours', Number(v))} options={OVERTIME_OPTIONS} />
        </Field>
        <Field label="Hợp đồng" required error={errors.contractYears}>
          <OptionGroup label="Hợp đồng" options={CONTRACT_OPTIONS} value={String(d.contractYears) as '1' | '3' | '5'} onChange={(v) => set('contractYears', Number(v))} size="sm" />
        </Field>
        <Field label="Chi phí xuất cảnh" hint="Để 0 nếu đơn miễn phí">
          <span className="ef-affix">
            <input className="ef-input" inputMode="numeric" value={d.feeUsd === '' ? '' : formatNumber(Number(d.feeUsd))} placeholder="VD: 5.500" onChange={(e) => set('feeUsd', e.target.value.replace(/\D/g, '').slice(0, 5))} />
            <span className="ef-affix__unit">USD</span>
          </span>
        </Field>
      </div>

      <Field label="Phúc lợi">
        <div className="jp-benefits">
          {JOB_BENEFITS.map((b) => (
            <CheckCard key={b} checked={d.benefits.includes(b)} onChange={() => set('benefits', toggleIn(d.benefits, b))}>
              {b}
            </CheckCard>
          ))}
        </div>
      </Field>
    </FormSection>
  );
}

/* ---------- 4. Nhận hồ sơ & hiển thị ---------- */
function DisplaySection({ d, set, errors, team, boostsLeft, company }: SectionProps & { team: TeamMember[]; boostsLeft: number; company: boolean }) {
  const [question, setQuestion] = useState('');
  const [kind, setKind] = useState<ScreeningKind>('yes_no');
  const [reject, setReject] = useState(false);
  const addQuestion = () => {
    const q = question.trim();
    if (q.length < 5 || d.screening.length >= 5) return;
    set('screening', [...d.screening, { question: q, kind, ...(reject && kind === 'yes_no' ? { rejectIf: 'Có' } : {}) }]);
    setQuestion('');
    setReject(false);
  };
  return (
    <FormSection num={4} id="jp-display" title="Nhận hồ sơ & hiển thị" desc="Chọn cách nhận hồ sơ và mức độ nổi bật của tin.">
      <div className="ef-grid">
        <Field label="Hạn nhận hồ sơ" required error={errors.deadline}>
          <input type="date" className={cx('ef-input', errors.deadline && 'ef-input--invalid')} value={d.deadline} aria-invalid={!!errors.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </Field>
        <Field label="Cán bộ phụ trách">
          <Select
            className="field-input field-input--select ef-select"
            aria-label="Cán bộ phụ trách"
            value={d.recruiterId}
            onChange={(v) => set('recruiterId', v)}
            options={team.map((m) => ({ value: m.id, label: m.isMe ? `${m.name} (bạn)` : m.name }))}
          />
        </Field>
        <Field label="Dự kiến xuất cảnh">
          <input type="date" className="ef-input" value={d.departureAt} onChange={(e) => set('departureAt', e.target.value)} />
        </Field>
        {!company && <span className="ef-field__hint jp-partner-note">Tin của NTD cá nhân đứng tên doanh nghiệp phái cử còn hiệu lực liên kết.</span>}
      </div>

      <Field label="Nhận hồ sơ qua">
        <div className="jp-channels">
          {(Object.keys(CHANNEL_LABEL) as JobChannel[]).map((c) => (
            <CheckCard key={c} checked={d.channels.includes(c)} onChange={() => set('channels', toggleIn(d.channels, c))}>
              {CHANNEL_LABEL[c]}
            </CheckCard>
          ))}
        </div>
      </Field>

      <Field label="Câu hỏi sàng lọc" hint="Hồ sơ trả lời sai câu hỏi loại trực tiếp sẽ tự chuyển sang “Không phù hợp”.">
        <ol className="jp-questions">
          {d.screening.map((q, i) => (
            <li key={`${q.question}-${i}`} className="jp-question">
              <span className="jp-question__num">{i + 1}</span>
              <span className="jp-question__text">{q.question}</span>
              <span className="jp-question__tag">{q.kind === 'yes_no' ? 'Có / Không' : 'Chọn 1'}</span>
              {q.rejectIf && <span className="jp-question__tag jp-question__tag--reject">Loại nếu “{q.rejectIf}”</span>}
              <button type="button" className="ef-tag__remove" aria-label="Bỏ câu hỏi" onClick={() => set('screening', d.screening.filter((_, k) => k !== i))}>
                <IconCloseSmall size={12} className="icon--w26" />
              </button>
            </li>
          ))}
        </ol>
        {d.screening.length < 5 && (
          <span className="jp-question-add">
            <input className="ef-input" value={question} maxLength={160} placeholder="VD: Bạn có thể xuất cảnh trước tháng 3/2027?" aria-label="Câu hỏi sàng lọc mới" onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())} />
            <OptionGroup label="Kiểu câu hỏi" options={[{ value: 'yes_no', label: 'Có / Không' }, { value: 'choice', label: 'Chọn 1' }]} value={kind} onChange={(v) => setKind(v as ScreeningKind)} size="sm" />
            {kind === 'yes_no' && (
              <CheckCard checked={reject} onChange={() => setReject((v) => !v)} className="jp-question-add__reject">
                Loại nếu “Có”
              </CheckCard>
            )}
            <button type="button" className="emp-btn emp-btn--md" disabled={question.trim().length < 5} onClick={addQuestion}>
              <IconPlus size={14} />
              Thêm câu hỏi
            </button>
          </span>
        )}
      </Field>

      <Field label="Gói hiển thị" error={errors.visibility}>
        <div className="jp-visibility" role="radiogroup" aria-label="Gói hiển thị">
          {VISIBILITY.map((v) => (
            <button key={v.value} type="button" role="radio" aria-checked={d.visibility === v.value} className={cx('jp-visibility__card', d.visibility === v.value && 'jp-visibility__card--on')} onClick={() => set('visibility', v.value)}>
              <span className="jp-visibility__head">
                <span className="jp-visibility__radio" />
                {v.tag && <span className="jp-visibility__tag">{v.tag}</span>}
              </span>
              <b>{v.title}</b>
              <span className="jp-visibility__desc">{v.desc}</span>
              <span className="jp-visibility__cost">{v.cost}</span>
            </button>
          ))}
        </div>
        <span className="ef-field__hint">Còn {boostsLeft} lượt đẩy tin trong gói.</span>
      </Field>
    </FormSection>
  );
}

/* ---------- Cột phải ---------- */
function Preview({ d, mode, onMode, companyName, logo, verified }: { d: JobPostDraft; mode: 'desktop' | 'mobile'; onMode: (m: 'desktop' | 'mobile') => void; companyName: string; logo: string | null; verified: boolean }) {
  const cover = d.gallery[0] ?? '/images/jobs/job-01.jpg';
  const programLabel = PROGRAM_OPTIONS.find((p) => p.value === d.program)?.label ?? '';
  return (
    <div className="emp-card jp-card" id="jp-preview">
      <span className="jp-card__head">
        <b className="jp-card__title">Xem trước trên viecpro</b>
        <span className="jp-toggle" role="radiogroup" aria-label="Kiểu xem trước">
          <button type="button" role="radio" aria-checked={mode === 'desktop'} className={cx('jp-toggle__btn', mode === 'desktop' && 'jp-toggle__btn--on')} onClick={() => onMode('desktop')}>
            Máy tính
          </button>
          <button type="button" role="radio" aria-checked={mode === 'mobile'} className={cx('jp-toggle__btn', mode === 'mobile' && 'jp-toggle__btn--on')} onClick={() => onMode('mobile')}>
            Điện thoại
          </button>
        </span>
      </span>
      <div className={cx('jp-preview', mode === 'mobile' && 'jp-preview--mobile')}>
        <span className="jp-preview__media">
          <img src={srcOf(cover)} alt="" />
          <span className="jp-preview__badges">
            {d.visibility === 'featured' && <span className="jp-preview__badge jp-preview__badge--hot">HOT</span>}
            {d.visibility === 'urgent' && <span className="jp-preview__badge jp-preview__badge--urgent">GẤP</span>}
            {programLabel && <span className="jp-preview__badge">{programLabel.toUpperCase()}</span>}
          </span>
        </span>
        <span className="jp-preview__body">
          <b className="jp-preview__title">{d.title || 'Tiêu đề tin tuyển dụng'}</b>
          <span className="jp-preview__meta">
            {d.pref || 'Tỉnh'}, Nhật Bản{d.examAt ? ` · Thi tuyển ${dayMonth(d.examAt, true)}` : ''}
          </span>
          <span className="jp-preview__salary">
            {d.salary ? `${formatNumber(d.salary)} ¥` : '— ¥'}
            <small> / tháng</small>
          </span>
          <span className="jp-preview__chips">
            {d.gender && <span>{GENDER_OPTIONS.find((g) => g.value === d.gender)?.label === 'Không yêu cầu' ? 'Nam/Nữ' : GENDER_OPTIONS.find((g) => g.value === d.gender)?.label}</span>}
            <span>
              {d.ageFrom}–{d.ageTo} tuổi
            </span>
            <span>{d.quantity} chỉ tiêu</span>
            {d.contractYears > 0 && <span>HĐ {d.contractYears} năm</span>}
          </span>
          <span className="jp-preview__company">
            {logo ? <img src={logo} alt="" /> : <span className="jp-preview__logo" />}
            <span>{companyName}</span>
            {verified && (
              <span className="jp-preview__verified">
                <IconCheck size={11} className="icon--w3" />
                Đã xác minh
              </span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}

function Quality({ quality }: { quality: ReturnType<typeof qualityOf> }) {
  const label = quality.score >= 80 ? 'Tốt – sẵn sàng gửi duyệt' : quality.score >= 60 ? 'Khá – nên bổ sung thêm' : 'Cần bổ sung thông tin';
  return (
    <div className="emp-card jp-card">
      <span className="jp-quality__head">
        <span className={cx('jp-quality__ring', quality.score < 60 && 'jp-quality__ring--low')} style={{ '--score': `${quality.score}%` } as CSSProperties}>
          <b>{quality.score}</b>
        </span>
        <span>
          <b className="jp-card__title">Chất lượng tin</b>
          <span className={cx('jp-quality__label', quality.score < 60 && 'jp-quality__label--low')}>{label}</span>
        </span>
      </span>
      <ul className="jp-quality__list">
        {quality.items.map((i) => (
          <li key={i.key} className={cx('jp-quality__item', !i.ok && 'jp-quality__item--todo')}>
            <span className="jp-quality__icon">{i.ok ? <IconCheck size={11} className="icon--w4" /> : <IconPlus size={11} className="icon--w4" />}</span>
            <span className="jp-quality__text">
              <span>{i.label}</span>
              <small>{i.note}</small>
            </span>
            <span className="jp-quality__points">{i.ok ? i.points : `+${i.points}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reach({ market }: { market: JobMarketInsight | null }) {
  return (
    <div className="jp-reach">
      <span className="jp-reach__label">
        <IconUser size={14} />
        Dự kiến tiếp cận
      </span>
      <b className="jp-reach__value">{market ? formatNumber(market.seekers) : '—'}</b>
      <span className="jp-reach__desc">Người lao động đang tìm việc phù hợp chương trình, giới tính và độ tuổi của tin trên viecpro.</span>
      <span className="jp-reach__boxes">
        <span className="jp-reach__box">
          <small>Hồ sơ dự kiến / 30 ngày</small>
          <b>{market ? `~ ${formatNumber(market.expectedApplications)} hồ sơ` : '—'}</b>
        </span>
        <span className="jp-reach__box">
          <small>Đủ chỉ tiêu sau</small>
          <b>{!market?.daysToFill ? '—' : market.daysToFill > 90 ? 'trên 90 ngày' : `${market.daysToFill} ngày`}</b>
        </span>
      </span>
    </div>
  );
}

function Reuse({ onPick }: { onPick: (id: string) => void }) {
  const [jobs, setJobs] = useState<EmployerJobList['items']>([]);
  useEffect(() => {
    void apiRequest<EmployerJobList>('/employer/jobs?tab=visible&sort=newest&page=1&limit=3')
      .then((d) => setJobs(d.items))
      .catch(() => setJobs([]));
  }, []);
  const list = useMemo(() => jobs.slice(0, 3), [jobs]);
  if (!list.length) return null;
  return (
    <div className="emp-card jp-card">
      <b className="jp-card__title">Dùng lại tin cũ</b>
      {list.map((j) => (
        <button key={j.id} type="button" className="jp-reuse" onClick={() => onPick(j.id)}>
          <img src={j.imageUrl} alt="" />
          <span className="jp-reuse__text">
            <b>{j.title}</b>
            <small>
              {j.code} · {formatNumber(j.applications)} hồ sơ
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}
