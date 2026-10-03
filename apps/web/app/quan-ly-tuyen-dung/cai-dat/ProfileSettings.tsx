'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { formatVnContactPhone, type CompanyProfileInput, type EmployerProfileSettings, type RecruiterProfileInput } from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { Field, FormSection } from '@/components/form/FormKit';
import { IconCheck, IconExternal, IconLock, IconSave } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { displayPhone } from '@/lib/employer';
import { cx } from '@/lib/format';
import { ImageField, ItemsEditor, StatsEditor, TagsEditor } from './SectionEditors';
import './settings.css';

type Tab = 'recruiter' | 'company';
type Recruiter = EmployerProfileSettings['recruiter'];
type Company = NonNullable<EmployerProfileSettings['company']>;

/** Cài đặt hồ sơ công khai: hồ sơ tư vấn viên (ai cũng sửa của mình) + hồ sơ công ty (quản trị viên doanh nghiệp) */
export default function ProfileSettings() {
  const { refresh } = useEmployerAccount();
  const [data, setData] = useState<EmployerProfileSettings | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('recruiter');

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<EmployerProfileSettings>('/employer/profile'));
    } catch (e) {
      setError(apiMessage(e, 'Không tải được hồ sơ.'));
    }
  }, []);
  useEffect(() => {
    void load();
    // Mở thẳng tab công ty: /quan-ly-tuyen-dung/cai-dat#cong-ty
    if (window.location.hash === '#cong-ty') setTab('company');
  }, [load]);

  const saved = (next: EmployerProfileSettings) => {
    setData(next);
    void refresh();
  };

  return (
    <div className="ps">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Cài đặt</span>
          </nav>
          <h1 className="emp-page-head__title">Cài đặt hồ sơ</h1>
        </span>
      </div>

      {error && (
        <div className="emp-state emp-state--error" role="alert">
          {error}
        </div>
      )}
      {!data && !error && <div className="emp-card ps-skeleton" aria-busy="true" />}

      {data && (
        <>
          {data.company && (
            <div className="ps-tabs" role="tablist" aria-label="Loại hồ sơ">
              <button type="button" role="tab" aria-selected={tab === 'recruiter'} className={cx('ps-tab', tab === 'recruiter' && 'ps-tab--on')} onClick={() => setTab('recruiter')}>
                Hồ sơ của tôi
              </button>
              <button type="button" role="tab" aria-selected={tab === 'company'} className={cx('ps-tab', tab === 'company' && 'ps-tab--on')} onClick={() => setTab('company')}>
                Hồ sơ công ty
                {!data.company.canEdit && <IconLock size={13} />}
              </button>
            </div>
          )}
          {tab === 'company' && data.company ? <CompanyForm key="company" company={data.company} onSaved={saved} /> : <RecruiterForm key="recruiter" recruiter={data.recruiter} onSaved={saved} />}
        </>
      )}
    </div>
  );
}

/** Lưu form: trạng thái bận, lỗi chung + lỗi từng trường từ API, thông báo đã lưu */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setFields({});
    try {
      await fn();
      setSavedAt(Date.now());
    } catch (e) {
      setError(apiMessage(e, 'Không lưu được hồ sơ.'));
      if (e instanceof ApiClientError && e.fields) setFields(e.fields);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, fields, savedAt, run };
}

function SaveBar({ busy, error, savedAt, publicHref, note }: { busy: boolean; error: string; savedAt: number | null; publicHref: string; note: ReactNode }) {
  return (
    <div className="ef-footer ps-footer">
      <span className="ef-footer__note">
        {error ? (
          <span className="ef-footer__error" role="alert">
            {error}
          </span>
        ) : savedAt ? (
          <span className="ps-saved" role="status">
            <IconCheck size={14} />
            Đã lưu – trang công khai đã cập nhật
          </span>
        ) : (
          <span className="ps-note">{note}</span>
        )}
      </span>
      <Link href={publicHref} className="emp-btn" target="_blank" rel="noopener">
        <IconExternal size={15} />
        Xem trang công khai
      </Link>
      <button type="submit" className="emp-btn emp-btn--primary" disabled={busy}>
        <IconSave size={16} />
        {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
      </button>
    </div>
  );
}

const phoneText = (e164: string | null) => (e164 ? displayPhone(e164) : '');

/** Bỏ dòng người dùng bấm "Thêm" rồi để trống – không chặn lưu vì một dòng thừa */
function pruneSections<T extends Record<string, unknown>>(sections: T): T {
  const blank = (v: unknown) => (typeof v === 'string' ? !v.trim() : Array.isArray(v) ? v.every(blank) : v && typeof v === 'object' ? Object.values(v).every(blank) : !v);
  return Object.fromEntries(Object.entries(sections).map(([k, list]) => [k, Array.isArray(list) ? list.filter((item) => !blank(item)) : list])) as T;
}

function RecruiterForm({ recruiter, onSaved }: { recruiter: Recruiter; onSaved: (d: EmployerProfileSettings) => void }) {
  const [d, setD] = useState({ ...recruiter, phone: phoneText(recruiter.phone) });
  const [photo, setPhoto] = useState<{ path: string | null; url: string | null } | null>(null);
  const save = useSave();
  const set = <K extends keyof typeof d>(key: K, value: (typeof d)[K]) => setD((cur) => ({ ...cur, [key]: value }));
  const setSection = <K extends keyof Recruiter['sections']>(key: K, value: Recruiter['sections'][K]) => setD((cur) => ({ ...cur, sections: { ...cur.sections, [key]: value } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save.run(async () => {
      const body: RecruiterProfileInput = {
        name: d.name,
        title: d.title,
        headline: d.headline ?? '',
        intro: d.intro ?? '',
        city: d.city ?? '',
        phone: d.phone.trim() || null,
        ...(photo && { photoPath: photo.path }),
        sections: pruneSections(d.sections),
      } as RecruiterProfileInput;
      onSaved(await apiRequest<EmployerProfileSettings>('/employer/profile/recruiter', { method: 'PUT', body: JSON.stringify(body) }));
      setPhoto(null);
    });
  };

  return (
    <form className="ps-card" onSubmit={submit} noValidate>
      <FormSection num={1} title="Thông tin cơ bản" desc="Hiển thị ở đầu trang tư vấn viên và trên mỗi tin bạn đăng">
        <ImageField url={photo ? photo.url : d.photoUrl} shape="round" hint="Ảnh chân dung rõ mặt · JPG / PNG / WebP, tối đa 5 MB" onChange={(path, url) => setPhoto({ path, url })} />
        <div className="ef-grid">
          <Field label="Họ và tên" required error={save.fields.name}>
            <input aria-label="Họ và tên" className="ef-input" value={d.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Chức danh" required error={save.fields.title}>
            <input aria-label="Chức danh" className="ef-input" value={d.title} maxLength={80} placeholder="vd. Chuyên viên tư vấn XKLĐ" onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Khu vực" error={save.fields.city}>
            <input aria-label="Khu vực" className="ef-input" value={d.city ?? ''} maxLength={60} placeholder="vd. Hà Nội" onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Số điện thoại liên hệ" hint="Người xem phải đăng nhập mới thấy số đầy đủ" error={save.fields.phone}>
            <input aria-label="Số điện thoại liên hệ" className="ef-input" value={d.phone} inputMode="tel" maxLength={20} placeholder="0912 345 678" onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Câu giới thiệu ngắn" className="ef-span-all" extra={`${(d.headline ?? '').length}/160`} error={save.fields.headline}>
            <input aria-label="Câu giới thiệu ngắn" className="ef-input" value={d.headline ?? ''} maxLength={160} placeholder="vd. Chuyên đơn thực tập sinh & kỹ năng đặc định" onChange={(e) => set('headline', e.target.value)} />
          </Field>
          <Field label="Giới thiệu" className="ef-span-all" extra={`${(d.intro ?? '').length}/3000`} error={save.fields.intro}>
            <textarea aria-label="Giới thiệu" className="ef-input ps-textarea ps-textarea--lg" value={d.intro ?? ''} maxLength={3000} onChange={(e) => set('intro', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection num={2} title="Con số nổi bật" desc="Tối đa 4 ô. Số đơn đang đăng và người theo dõi được tính tự động">
        <StatsEditor rows={d.sections.stats} max={4} onChange={(v) => setSection('stats', v)} />
      </FormSection>

      <FormSection num={3} title="Lĩnh vực & khu vực" desc="Ngành nghề bạn tư vấn và tỉnh / thành Nhật Bản thường tuyển">
        <div className="ef-grid">
          <Field label="Ngành nghề" hint="Nhấn Enter để thêm · tối đa 12">
            <TagsEditor values={d.sections.fields} max={12} label="Thêm ngành nghề" placeholder="vd. Điện tử – Lắp ráp" onChange={(v) => setSection('fields', v)} />
          </Field>
          <Field label="Tỉnh / thành Nhật Bản" hint="Tối đa 20">
            <TagsEditor values={d.sections.prefectures} max={20} label="Thêm tỉnh" placeholder="vd. Aichi" onChange={(v) => setSection('prefectures', v)} />
          </Field>
        </div>
      </FormSection>

      <FormSection num={4} title="Điểm mạnh" desc="Vì sao ứng viên nên chọn bạn – tối đa 6 mục">
        <ItemsEditor items={d.sections.values} max={6} addLabel="Thêm điểm mạnh" empty={{ title: '', desc: '' }} fields={[{ key: 'title', label: 'Tiêu đề', max: 60 }, { key: 'desc', label: 'Mô tả', max: 240, multiline: true }]} onChange={(v) => setSection('values', v)} />
      </FormSection>

      <FormSection num={5} title="Kinh nghiệm" desc="Quá trình làm việc, mới nhất ở trên">
        <ItemsEditor
          items={d.sections.timeline}
          max={12}
          addLabel="Thêm giai đoạn"
          empty={{ when: '', title: '', desc: '' }}
          fields={[{ key: 'when', label: 'Thời gian', max: 30, placeholder: 'vd. 2021 – nay' }, { key: 'title', label: 'Vị trí / công việc', max: 80 }, { key: 'desc', label: 'Mô tả', max: 300, multiline: true }]}
          onChange={(v) => setSection('timeline', v)}
        />
      </FormSection>

      <FormSection num={6} title="Chứng chỉ" desc="Tiếng Nhật, nghiệp vụ… – tối đa 10">
        <ItemsEditor items={d.sections.certificates} max={10} addLabel="Thêm chứng chỉ" empty={{ title: '', desc: '' }} fields={[{ key: 'title', label: 'Tên chứng chỉ', max: 80 }, { key: 'desc', label: 'Ghi chú', max: 200 }]} onChange={(v) => setSection('certificates', v)} />
      </FormSection>

      <SaveBar busy={save.busy} error={save.error} savedAt={save.savedAt} publicHref={`/tu-van-vien/${recruiter.slug}`} note="Trạng thái xác minh số điện thoại do ViecPro cập nhật" />
    </form>
  );
}

function CompanyForm({ company, onSaved }: { company: Company; onSaved: (d: EmployerProfileSettings) => void }) {
  const [d, setD] = useState({ ...company, phone: company.phone ? formatVnContactPhone(company.phone) : '' });
  const [logo, setLogo] = useState<{ path: string | null; url: string | null } | null>(null);
  const [cover, setCover] = useState<{ path: string | null; url: string | null } | null>(null);
  const save = useSave();
  const locked = !company.canEdit;
  const set = <K extends keyof typeof d>(key: K, value: (typeof d)[K]) => setD((cur) => ({ ...cur, [key]: value }));
  const setSection = <K extends keyof Company['sections']>(key: K, value: Company['sections'][K]) => setD((cur) => ({ ...cur, sections: { ...cur.sections, [key]: value } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    void save.run(async () => {
      const body = {
        shortName: d.shortName ?? '',
        intro: d.intro ?? '',
        phone: d.phone.trim() || null,
        email: d.email?.trim() || null,
        website: d.website ?? '',
        address: d.address ?? '',
        ...(logo && { logoPath: logo.path }),
        ...(cover && { coverPath: cover.path }),
        sections: pruneSections(d.sections),
      } as CompanyProfileInput;
      onSaved(await apiRequest<EmployerProfileSettings>('/employer/profile/company', { method: 'PUT', body: JSON.stringify(body) }));
      setLogo(null);
      setCover(null);
    });
  };

  return (
    <form className="ps-card" onSubmit={submit} noValidate>
      {locked && (
        <p className="ps-locked" role="note">
          <IconLock size={15} />
          Chỉ quản trị viên doanh nghiệp được sửa hồ sơ công ty. Bạn đang xem ở chế độ chỉ đọc.
        </p>
      )}
      <fieldset className="ps-fieldset" disabled={locked}>
        <FormSection num={1} title="Nhận diện" desc="Logo và ảnh bìa trên trang doanh nghiệp">
          <div className="ps-legal">
            <span>
              <small>Tên pháp lý</small>
              <b>{company.name}</b>
            </span>
            <span>
              <small>Mã số thuế</small>
              <b>{company.taxCode ?? '—'}</b>
            </span>
            <span>
              <small>Trạng thái</small>
              <b className={company.verified ? 'ps-ok' : undefined}>{company.verified ? 'Đã xác minh' : 'Chưa xác minh'}</b>
            </span>
            <small className="ps-legal__note">Đổi tên pháp lý hoặc mã số thuế cần xác minh lại – liên hệ viecpro.</small>
          </div>
          <div className="ps-images">
            <ImageField url={logo ? logo.url : d.logoUrl} shape="square" hint="Logo vuông, nền trong hoặc trắng · tối đa 5 MB" onChange={(path, url) => setLogo({ path, url })} />
            <ImageField url={cover ? cover.url : d.coverUrl} shape="wide" hint="Ảnh bìa ngang, tối thiểu 1200 × 400 px" onChange={(path, url) => setCover({ path, url })} />
          </div>
          <div className="ef-grid">
            <Field label="Tên ngắn" hint="Hiển thị trên thẻ tin và menu" error={save.fields.shortName}>
              <input aria-label="Tên ngắn" className="ef-input" value={d.shortName ?? ''} maxLength={60} placeholder="vd. Việt Nam CAMCOM" onChange={(e) => set('shortName', e.target.value)} />
            </Field>
            <Field label="Website" error={save.fields.website}>
              <input aria-label="Website" className="ef-input" value={d.website ?? ''} maxLength={200} inputMode="url" placeholder="https://" onChange={(e) => set('website', e.target.value)} />
            </Field>
            <Field label="Giới thiệu" className="ef-span-all" extra={`${(d.intro ?? '').length}/4000`} error={save.fields.intro}>
              <textarea aria-label="Giới thiệu" className="ef-input ps-textarea ps-textarea--lg" value={d.intro ?? ''} maxLength={4000} onChange={(e) => set('intro', e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection num={2} title="Liên hệ" desc="Hiển thị ở mục Liên hệ trên trang doanh nghiệp">
          <div className="ef-grid">
            <Field label="Điện thoại" hint="Di động, máy bàn hoặc hotline 1800 / 1900" error={save.fields.phone}>
              <input aria-label="Điện thoại" className="ef-input" value={d.phone} inputMode="tel" maxLength={20} placeholder="024 7109 4510" onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email" error={save.fields.email}>
              <input aria-label="Email" className="ef-input" type="email" value={d.email ?? ''} maxLength={120} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Địa chỉ" className="ef-span-all" error={save.fields.address}>
              <input aria-label="Địa chỉ" className="ef-input" value={d.address ?? ''} maxLength={200} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection num={3} title="Con số nổi bật" desc="Tối đa 4 ô. Số đơn đang tuyển và người theo dõi được tính tự động">
          <StatsEditor rows={d.sections.stats} max={4} onChange={(v) => setSection('stats', v)} />
        </FormSection>

        <FormSection num={4} title="Lĩnh vực & văn phòng">
          <div className="ef-grid">
            <Field label="Lĩnh vực hoạt động" hint="Nhấn Enter để thêm · tối đa 12">
              <TagsEditor values={d.sections.fields} max={12} label="Thêm lĩnh vực" placeholder="vd. Tư vấn tuyển dụng" onChange={(v) => setSection('fields', v)} />
            </Field>
            <Field label="Văn phòng" hint="Tối đa 10">
              <TagsEditor values={d.sections.offices} max={10} maxLength={80} label="Thêm văn phòng" placeholder="vd. Hà Nội – Trụ sở" onChange={(v) => setSection('offices', v)} />
            </Field>
          </div>
        </FormSection>

        <FormSection num={5} title="Dịch vụ & thế mạnh" desc="Tối đa 6 mục">
          <ItemsEditor items={d.sections.values} max={6} addLabel="Thêm mục" empty={{ title: '', desc: '' }} fields={[{ key: 'title', label: 'Tiêu đề', max: 60 }, { key: 'desc', label: 'Mô tả', max: 240, multiline: true }]} onChange={(v) => setSection('values', v)} />
        </FormSection>
      </fieldset>

      {locked ? (
        <div className="ef-footer ps-footer">
          <span className="ef-footer__note">
            <span className="ps-note">Thông tin pháp lý (giấy phép, người đại diện…) do viecpro cập nhật sau khi xác minh</span>
          </span>
          <Link href={`/nha-tuyen-dung/${company.slug}`} className="emp-btn" target="_blank" rel="noopener">
            <IconExternal size={15} />
            Xem trang công khai
          </Link>
        </div>
      ) : (
        <SaveBar busy={save.busy} error={save.error} savedAt={save.savedAt} publicHref={`/nha-tuyen-dung/${company.slug}`} note="Thông tin pháp lý (giấy phép, người đại diện…) do viecpro cập nhật sau khi xác minh" />
      )}
    </form>
  );
}
