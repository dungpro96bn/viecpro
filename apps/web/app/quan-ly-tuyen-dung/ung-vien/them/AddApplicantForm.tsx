'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  APPLICANT_SKILL_TAGS,
  APPLICATION_SOURCE_LABEL,
  DEPART_WITHIN_LABEL,
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  MANUAL_APPLICATION_SOURCES,
  MARITAL_LABEL,
  MARITAL_STATUSES,
  VN_PROVINCES,
  type ApplicantDuplicateCheck,
  type ApplicantImportResult,
  type ApplicantJobMatch,
  type EducationLevel,
  type EmployerApplicantItem,
  type JlptLevel,
  type ManualApplicationSource,
  type MaritalStatus,
  type PassportStatus,
  type TeamMember,
} from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { CheckCard, Field, FormSection, OptionGroup, toggleIn } from '@/components/form/FormKit';
import MatchBadge from '@/components/employer/MatchBadge';
import Select from '@/components/ui/Select';
import { IconCamera, IconCheck, IconDownload, IconEdit, IconFileSheet, IconPhone, IconPlus, IconSparkle, IconUpload } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, shortName } from '@/lib/employer';
import { cx, formatNumber } from '@/lib/format';
import { uploadAsset } from '@/lib/upload';

const YEAR = new Date().getFullYear();
/** Giấy tờ NTD đã xem bản gốc – lưu dạng nhãn trên hồ sơ, không lưu ảnh */
const CHECKED_PAPERS = ['Có CV', 'Có bằng tốt nghiệp'] as const;
type Mode = 'manual' | 'scan' | 'excel';
type Stage = 'new' | 'contacted' | 'interview';

interface Draft {
  fullName: string;
  phone: string;
  birthYear: string;
  gender: 'nam' | 'nu' | '';
  hometown: string;
  heightCm: string;
  weightKg: string;
  maritalStatus: MaritalStatus | '';
  email: string;
  education: EducationLevel | '';
  jlpt: JlptLevel | 'none';
  passport: PassportStatus | '';
  departWithin: string;
  experience: string;
  tags: string[];
  documents: Array<{ name: string; kind: 'pdf' | 'image'; sizeKb: number; path?: string }>;
  jobId: string;
  stage: Stage;
  assigneeId: string;
  source: ManualApplicationSource;
  note: string;
  consent: boolean;
}

const EMPTY: Draft = {
  fullName: '',
  phone: '',
  birthYear: '',
  gender: '',
  hometown: '',
  heightCm: '',
  weightKg: '',
  maritalStatus: '',
  email: '',
  education: 'thpt',
  jlpt: 'none',
  passport: '',
  departWithin: '',
  experience: '',
  tags: [],
  documents: [],
  jobId: '',
  stage: 'new',
  assigneeId: '',
  source: 'hotline',
  note: '',
  consent: false,
};

const MODES: Array<{ key: Mode; title: string; desc: string; tone: string; icon: typeof IconEdit; badge?: string }> = [
  { key: 'manual', title: 'Nhập thủ công', desc: 'Từ cuộc gọi, hồ sơ giấy, người đến trực tiếp', tone: 'blue', icon: IconEdit },
  { key: 'scan', title: 'Quét CV', desc: 'Tải CV để AI tự điền thông tin', tone: 'violet', icon: IconSparkle, badge: 'SẮP RA MẮT' },
  { key: 'excel', title: 'Nhập từ Excel', desc: 'Thêm hàng loạt, tối đa 500 hồ sơ / lần', tone: 'green', icon: IconFileSheet },
];

/** Thêm ứng viên (design 16) */
export default function AddApplicantForm() {
  const router = useRouter();
  const { account, refresh } = useEmployerAccount();
  const [mode, setMode] = useState<Mode>('manual');
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'more'>('');
  const [savedName, setSavedName] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [matches, setMatches] = useState<ApplicantJobMatch[]>([]);
  const [dupes, setDupes] = useState<ApplicantDuplicateCheck | null>(null);
  const [zalo, setZalo] = useState(true);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setD((x) => ({ ...x, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  useEffect(() => {
    void apiRequest<TeamMember[]>('/employer/team').then((t) => {
      setTeam(t);
      setD((x) => (x.assigneeId ? x : { ...x, assigneeId: t.find((m) => m.isMe)?.id ?? '' }));
    });
  }, []);

  // Tin phù hợp – cập nhật theo thông tin đang nhập
  const birthYear = Number(d.birthYear) || undefined;
  useEffect(() => {
    const p = new URLSearchParams();
    if (birthYear && birthYear > 1940) p.set('birthYear', String(birthYear));
    if (d.gender) p.set('gender', d.gender);
    if (d.jlpt !== 'none') p.set('jlpt', d.jlpt);
    if (d.passport) p.set('passport', d.passport);
    if (d.tags.length) p.set('tags', d.tags.join(','));
    const t = setTimeout(() => {
      apiRequest<ApplicantJobMatch[]>(`/employer/applications/job-match?${p.toString()}`)
        .then((list) => {
          setMatches(list);
          // Tự chọn tin phù hợp nhất nếu chưa chọn
          setD((x) => (x.jobId || !list[0] ? x : { ...x, jobId: list[0].job.id }));
        })
        .catch(() => setMatches([]));
    }, 300);
    return () => clearTimeout(t);
  }, [birthYear, d.gender, d.jlpt, d.passport, d.tags]);

  // Kiểm tra trùng khi nhập số điện thoại / họ tên
  useEffect(() => {
    if (d.phone.replace(/\D/g, '').length < 9 && d.fullName.trim().split(/\s+/).length < 2) return;
    const p = new URLSearchParams();
    if (d.phone.replace(/\D/g, '').length >= 9) p.set('phone', d.phone);
    if (d.fullName.trim()) p.set('name', d.fullName.trim());
    const t = setTimeout(() => {
      apiRequest<ApplicantDuplicateCheck>(`/employer/applications/duplicates?${p.toString()}`).then(setDupes).catch(() => setDupes(null));
    }, 500);
    return () => clearTimeout(t);
  }, [d.phone, d.fullName]);

  const validate = () => {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (d.fullName.trim().length < 2) e.fullName = 'Vui lòng nhập họ và tên';
    if (d.phone.replace(/\D/g, '').length < 9) e.phone = 'Số điện thoại chưa đúng';
    if (!birthYear || birthYear < YEAR - 60 || birthYear > YEAR - 16) e.birthYear = 'Năm sinh không hợp lệ (16 – 60 tuổi)';
    if (!d.gender) e.gender = 'Chọn giới tính';
    if (!d.jobId) e.jobId = 'Chọn tin tuyển dụng';
    if (!d.consent) e.consent = 'Cần xác nhận ứng viên đã đồng ý';
    return e;
  };

  const save = async (more: boolean) => {
    const found = validate();
    setErrors(found);
    setFormError('');
    setSavedName('');
    if (Object.keys(found).length) {
      setFormError('Vui lòng kiểm tra các trường được đánh dấu.');
      document.querySelector('.ef-field__error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(more ? 'more' : 'save');
    try {
      const created = await apiRequest<EmployerApplicantItem>('/employer/applications', {
        method: 'POST',
        body: JSON.stringify({
          jobId: d.jobId,
          fullName: d.fullName.trim(),
          phone: d.phone,
          birthYear,
          gender: d.gender,
          hometown: d.hometown || undefined,
          heightCm: Number(d.heightCm) || undefined,
          weightKg: Number(d.weightKg) || undefined,
          maritalStatus: d.maritalStatus || undefined,
          email: d.email.trim() || undefined,
          education: d.education || undefined,
          jlpt: d.jlpt === 'none' ? undefined : d.jlpt,
          passport: d.passport || undefined,
          departWithin: d.departWithin || undefined,
          experience: d.experience.trim() || undefined,
          tags: [...d.tags, ...(d.jlpt !== 'none' ? [d.jlpt] : []), ...(d.passport === 'has' ? ['Có hộ chiếu'] : [])],
          documents: d.documents,
          stage: d.stage === 'contacted' ? 'contacted' : 'new',
          assigneeId: d.assigneeId || undefined,
          source: d.source,
          note: d.note.trim() || undefined,
          consent: true,
        }),
      });
      await refresh();
      if (d.stage === 'interview') return router.push(`${EMPLOYER_BASE}/lich-phong-van/tao?app=${created.id}`);
      if (more) {
        setSavedName(created.fullName);
        setD({ ...EMPTY, jobId: d.jobId, source: d.source, assigneeId: d.assigneeId });
        setDupes(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      router.push(`${EMPLOYER_BASE}/ung-vien?id=${created.id}`);
    } catch (e) {
      setFormError(apiMessage(e, 'Không lưu được ứng viên.'));
      if (e instanceof ApiClientError && e.fields) {
        const mapped: Partial<Record<keyof Draft, string>> = {};
        for (const [k, v] of Object.entries(e.fields)) if (k.split('.')[0]! in EMPTY) mapped[k.split('.')[0] as keyof Draft] = v;
        setErrors(mapped);
      }
    } finally {
      setBusy('');
    }
  };

  const selectedJob = matches.find((m) => m.job.id === d.jobId) ?? null;
  const best = matches[0] ?? null;
  const completeness = useMemo(
    () => [
      { label: 'Họ tên & số điện thoại', ok: d.fullName.trim().length >= 2 && d.phone.replace(/\D/g, '').length >= 9 },
      { label: 'Năm sinh, giới tính, quê quán', ok: !!birthYear && !!d.gender && !!d.hometown },
      { label: 'Chiều cao, cân nặng', ok: !!d.heightCm && !!d.weightKg },
      { label: 'Trình độ tiếng Nhật', ok: d.jlpt !== 'none' },
      { label: 'Ảnh chân dung', ok: d.documents.some((x) => x.name.startsWith('Ảnh chân dung')) },
      { label: 'Giấy tờ đã kiểm tra', ok: CHECKED_PAPERS.some((t) => d.tags.includes(t)) },
      { label: 'Đồng ý xử lý dữ liệu', ok: d.consent },
    ],
    [d, birthYear],
  );
  const pct = Math.round((completeness.filter((c) => c.ok).length / completeness.length) * 100);
  const companyName = account.company?.shortName ?? account.company?.name ?? account.user.name;
  const assignee = team.find((m) => m.id === d.assigneeId);

  return (
    <div className="aa">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <Link href={`${EMPLOYER_BASE}/ung-vien`}>Ứng viên</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Thêm ứng viên</span>
          </nav>
          <h1 className="emp-page-head__title">Thêm ứng viên</h1>
        </span>
        <span className="emp-page-head__actions">
          <Link href={`${EMPLOYER_BASE}/ung-vien`} className="emp-btn aa-head-btn">
            Huỷ
          </Link>
          {mode === 'manual' && (
            <button type="button" className="emp-btn emp-btn--primary aa-head-btn" disabled={busy !== ''} onClick={() => void save(false)}>
              <IconCheck size={16} className="icon--w24" />
              {busy === 'save' ? 'Đang lưu…' : 'Lưu ứng viên'}
            </button>
          )}
        </span>
      </div>

      <div className="aa-modes" role="radiogroup" aria-label="Cách thêm ứng viên">
        {MODES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} className={cx('aa-mode', mode === m.key && 'aa-mode--on')} onClick={() => setMode(m.key)}>
            <span className={cx('aa-mode__icon', `aa-mode__icon--${m.tone}`)}>
              <m.icon size={20} />
            </span>
            <span className="aa-mode__text">
              <span className="aa-mode__title">
                <b>{m.title}</b>
                {m.badge && <span className="aa-mode__badge">{m.badge}</span>}
              </span>
              <span className="aa-mode__desc">{m.desc}</span>
            </span>
            <span className="aa-mode__radio" />
          </button>
        ))}
      </div>

      {savedName && (
        <p className="aa-saved" role="status">
          <IconCheck size={15} className="icon--w26" />
          Đã lưu hồ sơ {savedName}. Bạn có thể nhập ứng viên tiếp theo.
        </p>
      )}

      {mode === 'scan' && (
        <div className="emp-card aa-soon">
          <span className="aa-mode__icon aa-mode__icon--violet">
            <IconSparkle size={22} />
          </span>
          <b>Quét CV sắp ra mắt</b>
          {/* Chưa có API: nhận dạng giấy tờ (OCR) và tự điền form */}
          <p>Tính năng đọc CV và tự điền thông tin đang được phát triển. ViecPro không thu thập CCCD. Trong lúc chờ, hãy nhập thủ công hoặc nhập hàng loạt từ Excel.</p>
          <button type="button" className="emp-btn" onClick={() => setMode('manual')}>
            Nhập thủ công
          </button>
        </div>
      )}

      {mode === 'excel' && <ExcelImport onDone={refresh} />}

      {mode === 'manual' && (
        <div className="aa-layout">
          <div className="aa-main">
            <FormSection num={1} title="Thông tin cá nhân" desc="Số điện thoại dùng để kiểm tra trùng hồ sơ và liên hệ ứng viên.">
              <div className="aa-person">
                <PhotoUpload docs={d.documents} onChange={(docs) => set('documents', docs)} />
                <div className="ef-grid aa-person__fields">
                  <Field label="Họ và tên" required error={errors.fullName}>
                    <input className={cx('ef-input', errors.fullName && 'ef-input--invalid')} value={d.fullName} maxLength={80} placeholder="VD: Nguyễn Thị Hồng" aria-invalid={!!errors.fullName} onChange={(e) => set('fullName', e.target.value)} />
                  </Field>
                  <Field label="Số điện thoại" required error={errors.phone}>
                    <span className="ef-affix emp-icon-input">
                      <IconPhone size={15} />
                      <input className={cx('ef-input', errors.phone && 'ef-input--invalid')} type="tel" value={d.phone} maxLength={15} placeholder="09xx xxx xxx" aria-invalid={!!errors.phone} onChange={(e) => set('phone', e.target.value)} />
                    </span>
                  </Field>
                  <Field label="Năm sinh" required error={errors.birthYear} extra={birthYear && birthYear > 1940 ? `${YEAR - birthYear} tuổi` : undefined}>
                    <input className={cx('ef-input', errors.birthYear && 'ef-input--invalid')} inputMode="numeric" maxLength={4} value={d.birthYear} placeholder="VD: 1999" aria-invalid={!!errors.birthYear} onChange={(e) => set('birthYear', e.target.value.replace(/\D/g, ''))} />
                  </Field>
                  <Field label="Giới tính" required error={errors.gender}>
                    <OptionGroup label="Giới tính" options={[{ value: 'nu', label: 'Nữ' }, { value: 'nam', label: 'Nam' }]} value={d.gender} onChange={(v) => set('gender', v)} invalid={!!errors.gender} />
                  </Field>
                </div>
              </div>
              <div className="ef-grid ef-grid--4">
                <Field label="Quê quán">
                  <Select className="field-input field-input--select ef-select" aria-label="Quê quán" placeholder="Chọn tỉnh" value={d.hometown} onChange={(v) => set('hometown', v)} options={VN_PROVINCES.map((p) => ({ value: p, label: p }))} />
                </Field>
                <Field label="Chiều cao">
                  <span className="ef-affix">
                    <input className="ef-input" inputMode="numeric" maxLength={3} value={d.heightCm} onChange={(e) => set('heightCm', e.target.value.replace(/\D/g, ''))} />
                    <span className="ef-affix__unit">cm</span>
                  </span>
                </Field>
                <Field label="Cân nặng">
                  <span className="ef-affix">
                    <input className="ef-input" inputMode="numeric" maxLength={3} value={d.weightKg} onChange={(e) => set('weightKg', e.target.value.replace(/\D/g, ''))} />
                    <span className="ef-affix__unit">kg</span>
                  </span>
                </Field>
                <Field label="Hôn nhân">
                  <Select className="field-input field-input--select ef-select" aria-label="Hôn nhân" placeholder="Chọn" value={d.maritalStatus} onChange={(v) => set('maritalStatus', v as MaritalStatus)} options={MARITAL_STATUSES.map((m) => ({ value: m, label: MARITAL_LABEL[m] }))} />
                </Field>
                <Field label="Email" className="ef-span-2">
                  <input className="ef-input" type="email" value={d.email} maxLength={120} placeholder="Không bắt buộc" onChange={(e) => set('email', e.target.value)} />
                </Field>
              </div>
            </FormSection>

            <FormSection num={2} title="Trình độ & giấy tờ" desc="Thông tin này được dùng để chấm % phù hợp với từng đơn.">
              <div className="ef-grid">
                <Field label="Học vấn">
                  <Select className="field-input field-input--select ef-select" aria-label="Học vấn" value={d.education} onChange={(v) => set('education', v as EducationLevel)} options={EDUCATION_LEVELS.map((e) => ({ value: e, label: EDUCATION_LABEL[e] }))} />
                </Field>
                <Field label="Tiếng Nhật">
                  <OptionGroup label="Tiếng Nhật" size="sm" options={[{ value: 'none', label: 'Chưa có' }, { value: 'N5', label: 'N5' }, { value: 'N4', label: 'N4' }, { value: 'N3', label: 'N3 trở lên' }]} value={d.jlpt} onChange={(v) => set('jlpt', v as Draft['jlpt'])} />
                </Field>
                <Field label="Hộ chiếu">
                  <OptionGroup label="Hộ chiếu" size="sm" options={[{ value: 'has', label: 'Đã có' }, { value: 'processing', label: 'Đang làm' }, { value: 'none', label: 'Chưa có' }]} value={d.passport} onChange={(v) => set('passport', v as PassportStatus)} />
                </Field>
                <Field label="Có thể xuất cảnh">
                  <Select className="field-input field-input--select ef-select" aria-label="Có thể xuất cảnh" placeholder="Chọn" value={d.departWithin} onChange={(v) => set('departWithin', v)} options={Object.entries(DEPART_WITHIN_LABEL).map(([value, label]) => ({ value, label }))} />
                </Field>
              </div>
              <Field label="Kinh nghiệm & kỹ năng">
                <input className="ef-input" value={d.experience} maxLength={300} placeholder="VD: 3 năm công nhân may tại KCN, quen làm việc theo ca" onChange={(e) => set('experience', e.target.value)} />
              </Field>
              <Field label="Kỹ năng nổi bật">
                <div className="emp-chips">
                  {APPLICANT_SKILL_TAGS.map((t) => (
                    <CheckCard key={t} checked={d.tags.includes(t)} onChange={() => set('tags', toggleIn(d.tags, t))}>
                      {t}
                    </CheckCard>
                  ))}
                </div>
              </Field>
              {/* ViecPro không nhận CCCD; phần này chỉ ghi nhận hồ sơ và bằng cấp đã kiểm tra ngoài hệ thống. */}
              <Field label="Giấy tờ đã kiểm tra" hint="Không tải giấy tờ định danh lên ViecPro.">
                <div className="emp-chips">
                  {CHECKED_PAPERS.map((t) => (
                    <CheckCard key={t} checked={d.tags.includes(t)} onChange={() => set('tags', toggleIn(d.tags, t))}>
                      {t}
                    </CheckCard>
                  ))}
                </div>
              </Field>
            </FormSection>

            <FormSection num={3} title="Ứng tuyển vào đơn" desc="Đơn được sắp xếp theo mức độ phù hợp với thông tin vừa nhập.">
              <Field label="Chọn tin tuyển dụng" required error={errors.jobId}>
                <div className="aa-jobs" role="radiogroup" aria-label="Tin tuyển dụng">
                  {matches.slice(0, 6).map((m) => (
                    <button key={m.job.id} type="button" role="radio" aria-checked={d.jobId === m.job.id} className={cx('aa-job', d.jobId === m.job.id && 'aa-job--on', m.score < 60 && 'aa-job--low')} onClick={() => set('jobId', m.job.id)}>
                      <span className="aa-job__radio" />
                      <img src={m.job.imageUrl} alt="" />
                      <span className="aa-job__text">
                        <b>{m.job.title}</b>
                        <span className={cx('aa-job__reason', !m.reason.ok && 'aa-job__reason--warn')}>{m.reason.text}</span>
                      </span>
                      <MatchBadge score={m.score} />
                    </button>
                  ))}
                  {!matches.length && <p className="emp-empty">Chưa có tin đang hiển thị để thêm ứng viên.</p>}
                </div>
              </Field>
              <div className="ef-grid">
                <Field label="Bước bắt đầu">
                  <OptionGroup label="Bước bắt đầu" size="sm" options={[{ value: 'new', label: 'Mới' }, { value: 'contacted', label: 'Đã liên hệ' }, { value: 'interview', label: 'Hẹn phỏng vấn' }]} value={d.stage} onChange={(v) => set('stage', v as Stage)} />
                </Field>
                <Field label="Cán bộ phụ trách">
                  <Select className="field-input field-input--select ef-select" aria-label="Cán bộ phụ trách" value={d.assigneeId} onChange={(v) => set('assigneeId', v)} options={team.map((m) => ({ value: m.id, label: m.isMe ? `${m.name} (bạn)` : m.name }))} />
                </Field>
              </div>
              <Field label="Nguồn ứng viên">
                <OptionGroup label="Nguồn ứng viên" size="sm" options={MANUAL_APPLICATION_SOURCES.map((s) => ({ value: s, label: APPLICATION_SOURCE_LABEL[s] }))} value={d.source} onChange={(v) => set('source', v)} />
              </Field>
              <Field label="Ghi chú nội bộ">
                <textarea className="ef-input" rows={3} value={d.note} maxLength={1000} placeholder="Ví dụ: Gọi hotline chiều 29/09, muốn đi đơn điện tử, gia đình đồng ý…" onChange={(e) => set('note', e.target.value)} />
              </Field>
              <CheckCard checked={d.consent} onChange={() => set('consent', !d.consent)} className={cx('aa-consent', errors.consent && 'aa-consent--invalid')}>
                <span>Ứng viên đã đồng ý để doanh nghiệp lưu trữ và xử lý thông tin cá nhân cho mục đích tuyển dụng.</span>
              </CheckCard>
              {errors.consent && (
                <span className="ef-field__error" role="alert">
                  {errors.consent}
                </span>
              )}
            </FormSection>

            <div className="ef-footer">
              <span className="ef-footer__note">
                {formError ? (
                  <span className="ef-footer__error" role="alert">
                    {formError}
                  </span>
                ) : (
                  <>
                    <IconPhone size={15} />
                    Sau khi lưu, hồ sơ xuất hiện ở cột “{d.stage === 'contacted' ? 'Đã liên hệ' : 'Mới'}” của {selectedJob ? `đơn ${selectedJob.job.code}` : 'đơn đã chọn'}
                    {d.stage === 'interview' ? ' và chuyển sang tạo lịch hẹn' : ''}
                  </>
                )}
              </span>
              <button type="button" className="emp-btn" disabled={busy !== ''} onClick={() => void save(true)}>
                <IconPlus size={16} />
                {busy === 'more' ? 'Đang lưu…' : 'Lưu & thêm tiếp'}
              </button>
              <button type="button" className="emp-btn emp-btn--primary" disabled={busy !== ''} onClick={() => void save(false)}>
                <IconCheck size={16} className="icon--w24" />
                {busy === 'save' ? 'Đang lưu…' : 'Lưu ứng viên'}
              </button>
            </div>
          </div>

          <aside className="aa-side">
            <div className="emp-card emp-side-card">
              <b className="emp-side-card__title">Kiểm tra trùng hồ sơ</b>
              {!dupes ? (
                <p className="emp-hint">Nhập số điện thoại hoặc họ tên để kiểm tra.</p>
              ) : dupes.phoneMatches.length ? (
                <span className="aa-dupe aa-dupe--warn">
                  <b>Số điện thoại đã có {dupes.phoneMatches.length} hồ sơ</b>
                  {dupes.phoneMatches.map((m) => (
                    <Link key={m.id} href={`${EMPLOYER_BASE}/ung-vien?id=${m.id}`} className="aa-dupe__item">
                      {m.fullName} · {m.jobShortTitle} · {dayMonth(m.createdAt, true)}
                    </Link>
                  ))}
                </span>
              ) : (
                <span className="aa-dupe">
                  <IconCheck size={14} className="icon--w3" />
                  <span>
                    <b>Số điện thoại chưa có trong hệ thống</b>
                    <small>Đã kiểm tra {formatNumber(dupes.checked)} hồ sơ của {account.kind === 'company' ? 'doanh nghiệp' : 'bạn'}</small>
                  </span>
                </span>
              )}
              {dupes?.similarNames.map((m) => (
                <span key={m.id} className="aa-similar">
                  <span className="emp-avatar emp-avatar--sm emp-avatar--pink">{m.fullName.trim().split(/\s+/).pop()?.charAt(0)}</span>
                  <span className="aa-similar__text">
                    <b>{m.fullName}</b>
                    <small>
                      Tên gần giống{m.hometown ? ` · ${m.hometown}` : ''} · ứng tuyển {dayMonth(m.createdAt, true)}
                    </small>
                  </span>
                  <Link href={`${EMPLOYER_BASE}/ung-vien?id=${m.id}`} className="emp-link-btn">
                    So sánh
                  </Link>
                </span>
              ))}
            </div>

            {best && (
              <div className="aa-best">
                <span className="aa-best__label">
                  <IconSparkle size={14} />
                  Phù hợp nhất với
                </span>
                <b className="aa-best__title">{best.job.title}</b>
                <span className="aa-best__row">
                  <b>{best.score}%</b>
                  <span>{best.reason.text}</span>
                </span>
              </div>
            )}

            <div className="emp-card emp-side-card">
              <span className="emp-side-card__head">
                <b className="emp-side-card__title">Độ đầy đủ hồ sơ</b>
                <b className="aa-card__pct">{pct}%</b>
              </span>
              <span className="emp-bar">
                <span className="emp-bar__fill emp-bar__fill--success" style={{ width: `${pct}%` }} />
              </span>
              <ul className="aa-checklist">
                {completeness.map((c) => (
                  <li key={c.label} className={cx(!c.ok && 'aa-checklist__todo')}>
                    {c.ok ? <IconCheck size={12} className="icon--w3" /> : <IconPlus size={12} className="icon--w3" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="emp-card emp-side-card">
              <span className="emp-side-card__head">
                <b className="emp-side-card__title">Gửi Zalo cho ứng viên</b>
                <button type="button" role="switch" aria-checked={zalo} aria-label="Gửi Zalo cho ứng viên" className={cx('emp-switch', zalo && 'emp-switch--on')} onClick={() => setZalo((v) => !v)}>
                  <span className="emp-switch__knob" />
                </button>
              </span>
              {zalo && (
                <p className="aa-zalo">
                  Chào {d.fullName ? shortName(d.fullName).split(' ').pop() : 'bạn'}, {companyName} đã nhận hồ sơ của bạn cho đơn “{selectedJob?.job.title ?? '…'}”. Cán bộ {assignee?.name ?? account.user.name} sẽ liên hệ trong 24 giờ.
                </p>
              )}
              {/* Chưa có API: gửi tin nhắn qua Zalo OA của doanh nghiệp */}
              <small className="emp-hint">Gửi từ Zalo OA {companyName} sau khi lưu (sắp ra mắt).</small>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ---------- Ảnh chân dung & giấy tờ ---------- */
function PhotoUpload({ docs, onChange }: { docs: Draft['documents']; onChange: (d: Draft['documents']) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photo = docs.find((x) => x.name.startsWith('Ảnh chân dung'));
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { assetPath } = await uploadAsset(file, 'image');
      onChange([...docs.filter((x) => !x.name.startsWith('Ảnh chân dung')), { name: `Ảnh chân dung.${file.name.split('.').pop()}`, kind: 'image', sizeKb: Math.ceil(file.size / 1024), path: assetPath }]);
    } catch (err) {
      setError(apiMessage(err, err instanceof Error ? err.message : 'Không tải được ảnh.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="aa-photo-wrap">
      <label className={cx('aa-photo', photo && 'aa-photo--done')} title={error || undefined}>
        {photo ? <IconCheck size={20} className="icon--w26" /> : <IconCamera size={20} />}
        <span>{busy ? 'Đang tải…' : photo ? 'Đã có ảnh' : 'Ảnh chân dung'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={busy} onChange={(e) => void pick(e)} />
      </label>
      {error && (
        <small className="aa-photo__error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}

/* ---------- Nhập từ Excel ---------- */
const CSV_HEAD = ['Họ tên', 'Số điện thoại', 'Năm sinh', 'Giới tính', 'Quê quán', 'Mã tin'];

/** Đọc CSV (dấu phẩy hoặc chấm phẩy, có ngoặc kép) */
function parseCsv(text: string): string[][] {
  const sep = (text.split('\n')[0] ?? '').includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      cur.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(cell.trim());
      if (cur.some(Boolean)) rows.push(cur);
      cur = [];
      cell = '';
    } else cell += ch;
  }
  cur.push(cell.trim());
  if (cur.some(Boolean)) rows.push(cur);
  return rows;
}

function ExcelImport({ onDone }: { onDone: () => Promise<void> }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState<ManualApplicationSource>('job_fair');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ApplicantImportResult | null>(null);

  const template = () => {
    const blob = new Blob(['﻿' + [CSV_HEAD.join(','), 'Nguyễn Thị Hồng,0912458327,1999,Nữ,Nghệ An,VP-10237'].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-nhap-ung-vien.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    setResult(null);
    setError('');
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setError('Chọn tệp .csv (trong Excel: Lưu thành → CSV UTF-8).');
    if (file.size > 2 * 1024 * 1024) return setError('Tệp tối đa 2 MB.');
    const parsed = parseCsv((await file.text()).replace(/^﻿/, ''));
    const data = parsed[0]?.[0]?.toLowerCase().includes('họ') ? parsed.slice(1) : parsed;
    if (!data.length) return setError('Tệp không có dòng dữ liệu.');
    if (data.length > 500) return setError('Tối đa 500 hồ sơ mỗi lần.');
    setFileName(file.name);
    setRows(data);
  };

  const submit = async () => {
    if (!consent) return setError('Cần xác nhận ứng viên đã đồng ý xử lý dữ liệu.');
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<ApplicantImportResult>('/employer/applications/import', {
        method: 'POST',
        body: JSON.stringify({
          source,
          consent: true,
          rows: rows.map((r) => ({ fullName: r[0] ?? '', phone: r[1] ?? '', birthYear: Number(r[2]) || 0, gender: r[3] ?? '', hometown: r[4] || undefined, jobCode: r[5] ?? '' })),
        }),
      });
      setResult(res);
      setRows([]);
      await onDone();
    } catch (err) {
      setError(apiMessage(err, 'Không nhập được tệp.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="emp-card aa-import">
      <span className="aa-import__head">
        <b>Nhập ứng viên từ tệp Excel</b>
        <button type="button" className="emp-btn emp-btn--md" onClick={template}>
          <IconDownload size={14} />
          Tải tệp mẫu
        </button>
      </span>
      <p className="emp-hint">Các cột theo thứ tự: {CSV_HEAD.join(' · ')}. Trong Excel chọn “Lưu thành → CSV UTF-8”. Tối đa 500 dòng mỗi lần; dòng lỗi sẽ được bỏ qua và báo lại.</p>
      <label className="aa-docs__drop aa-import__drop">
        <IconUpload size={18} />
        {fileName ? `${fileName} · ${formatNumber(rows.length)} dòng` : 'Chọn tệp .csv'}
        <input type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(e) => void pick(e)} />
      </label>
      {rows.length > 0 && (
        <div className="aa-import__preview" role="table" aria-label="Xem trước dữ liệu">
          {[CSV_HEAD, ...rows.slice(0, 5)].map((r, i) => (
            <span key={i} className={cx('aa-import__row', i === 0 && 'aa-import__row--head')} role="row">
              {CSV_HEAD.map((_, k) => (
                <span key={k} role="cell">
                  {r[k] ?? ''}
                </span>
              ))}
            </span>
          ))}
          {rows.length > 5 && <span className="emp-hint">… và {formatNumber(rows.length - 5)} dòng khác</span>}
        </div>
      )}
      <Field label="Nguồn ứng viên">
        <OptionGroup label="Nguồn ứng viên" size="sm" options={MANUAL_APPLICATION_SOURCES.map((s) => ({ value: s, label: APPLICATION_SOURCE_LABEL[s] }))} value={source} onChange={setSource} />
      </Field>
      <CheckCard checked={consent} onChange={() => setConsent((v) => !v)} className="aa-consent">
        <span>Các ứng viên trong tệp đã đồng ý để doanh nghiệp lưu trữ và xử lý thông tin cá nhân.</span>
      </CheckCard>
      {error && (
        <span className="ef-field__error" role="alert">
          {error}
        </span>
      )}
      {result && (
        <div className="aa-import__result" role="status">
          <b>Đã thêm {formatNumber(result.created)} hồ sơ.</b>
          {result.skipped.length > 0 && (
            <ul>
              {result.skipped.slice(0, 20).map((s) => (
                <li key={s.row}>
                  Dòng {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          )}
          <Link href={`${EMPLOYER_BASE}/ung-vien`} className="emp-link-btn">
            Xem danh sách ứng viên →
          </Link>
        </div>
      )}
      <button type="button" className="emp-btn emp-btn--primary aa-import__submit" disabled={!rows.length || busy} onClick={() => void submit()}>
        {busy ? 'Đang nhập…' : `Nhập ${rows.length ? formatNumber(rows.length) : ''} hồ sơ`}
      </button>
    </div>
  );
}
