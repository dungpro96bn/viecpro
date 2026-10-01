'use client';

import { useState, type ReactNode } from 'react';
import {
  DEPART_WITHIN_LABEL,
  GENDER_LABEL,
  INDUSTRIES,
  JLPT_LEVELS,
  MARITAL_LABEL,
  MARITAL_STATUSES,
  PREFECTURES_BY_REGION,
  PROGRAM_LABEL,
  PROGRAMS,
  REGION_LABEL,
  REGIONS,
  VN_PROVINCES,
  type Gender,
  type JlptLevel,
  type MaritalStatus,
  type SeekerExperience,
  type SeekerProfile,
  type SeekerProfileInput,
  type SeekerSkill,
} from '@viecpro/shared';
import { CheckCard, Field, OptionGroup, toggleIn } from '@/components/form/FormKit';
import Select from '@/components/ui/Select';
import { IconBriefcase, IconChatSquare, IconCheck, IconClock, IconCloseSmall, IconEdit, IconGraduation, IconPin, IconPlus, IconUser } from '@/components/ui/Icons';
import { ApiClientError, apiMessage } from '@/lib/api';
import { displayPhone } from '@/lib/employer';
import { cx } from '@/lib/format';
import { experienceRange, prefsSummary, yen } from '@/lib/seeker';

const YEAR = new Date().getFullYear();
export type SaveProfile = (patch: SeekerProfileInput) => Promise<SeekerProfile>;
type Errors = Record<string, string>;

/* ---------- Khung thẻ mục ---------- */
export function SectionCard({ id, icon, tone = 'blue', title, desc, action, children }: { id: string; icon: ReactNode; tone?: string; title: string; desc: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="sp-card" id={id} aria-labelledby={`${id}-title`}>
      <div className="sp-card__head">
        <span className={cx('sp-card__icon', `sp-card__icon--${tone}`)}>{icon}</span>
        <span className="sp-card__titles">
          <h2 className="sp-card__title" id={`${id}-title`}>
            {title}
          </h2>
          <span className="sp-card__desc">{desc}</span>
        </span>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EditButton({ onClick, label = 'Sửa', icon = 'edit' }: { onClick: () => void; label?: string; icon?: 'edit' | 'plus' }) {
  return (
    <button type="button" className="sp-edit-btn" onClick={onClick}>
      {icon === 'edit' ? <IconEdit size={14} /> : <IconPlus size={14} />}
      {label}
    </button>
  );
}

/** Nút Lưu / Huỷ + lỗi chung của form trong thẻ */
function EditActions({ busy, error, onCancel }: { busy: boolean; error: string; onCancel: () => void }) {
  return (
    <div className="sp-form__actions">
      {error && (
        <span className="sp-form__error" role="alert">
          {error}
        </span>
      )}
      <button type="button" className="btn btn--outline btn--sm" onClick={onCancel} disabled={busy}>
        Huỷ
      </button>
      <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
        <IconCheck size={14} />
        {busy ? 'Đang lưu…' : 'Lưu'}
      </button>
    </div>
  );
}

/** Gửi PATCH, trả lỗi theo trường từ API */
function useSaver(save: SaveProfile, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Errors>({});
  const run = async (patch: SeekerProfileInput, local: Errors = {}) => {
    setFields(local);
    setError('');
    if (Object.keys(local).length) return setError('Vui lòng kiểm tra các trường được đánh dấu.');
    setBusy(true);
    try {
      await save(patch);
      onDone();
    } catch (e) {
      setError(apiMessage(e, 'Không lưu được. Vui lòng thử lại.'));
      if (e instanceof ApiClientError && e.fields) setFields(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k.split('.')[0]!, v])));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, fields, run, reset: () => (setError(''), setFields({})) };
}

function InfoGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="sp-info">
      {items.map(([k, v]) => (
        <div key={k} className="sp-info__item">
          <dt>{k}</dt>
          <dd>{v || <span className="sp-info__empty">Chưa cập nhật</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/* ---------- 1. Thông tin cá nhân ---------- */
export function PersonalSection({ profile, save, preview, avatar }: { profile: SeekerProfile; save: SaveProfile; preview: boolean; avatar: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const init = () => ({
    name: profile.name,
    email: profile.email ?? '',
    birthYear: profile.birthYear ? String(profile.birthYear) : '',
    gender: (profile.gender ?? '') as Gender | '',
    hometown: profile.hometown ?? '',
    address: profile.address ?? '',
    heightCm: profile.heightCm ? String(profile.heightCm) : '',
    weightKg: profile.weightKg ? String(profile.weightKg) : '',
    eyesight: profile.eyesight ?? '',
    maritalStatus: (profile.maritalStatus ?? '') as MaritalStatus | '',
    tattoo: profile.tattoo === null ? '' : profile.tattoo ? 'yes' : 'no',
    about: profile.about ?? '',
  });
  const [d, setD] = useState(init);
  const s = useSaver(save, () => setEditing(false));
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setD((x) => ({ ...x, [k]: v }));
  const age = profile.birthYear ? YEAR - profile.birthYear : null;

  const submit = () => {
    const e: Errors = {};
    const by = Number(d.birthYear);
    if (d.name.trim().length < 2) e.name = 'Vui lòng nhập họ và tên';
    if (!by || by < YEAR - 60 || by > YEAR - 16) e.birthYear = 'Năm sinh không hợp lệ (16 – 60 tuổi)';
    if (!d.gender) e.gender = 'Chọn giới tính';
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = 'Email chưa đúng';
    if (d.heightCm && (Number(d.heightCm) < 120 || Number(d.heightCm) > 220)) e.heightCm = 'Từ 120 – 220 cm';
    if (d.weightKg && (Number(d.weightKg) < 30 || Number(d.weightKg) > 150)) e.weightKg = 'Từ 30 – 150 kg';
    void s.run(
      {
        name: d.name.trim(),
        email: d.email.trim() || null,
        birthYear: by,
        gender: d.gender || undefined,
        hometown: d.hometown || null,
        address: d.address.trim() || null,
        heightCm: numOrNull(d.heightCm),
        weightKg: numOrNull(d.weightKg),
        eyesight: d.eyesight.trim() || null,
        maritalStatus: d.maritalStatus || null,
        tattoo: d.tattoo === '' ? null : d.tattoo === 'yes',
        about: d.about.trim() || null,
      },
      e,
    );
  };

  return (
    <SectionCard
      id="ca-nhan"
      icon={<IconUser size={18} />}
      title="Thông tin cá nhân"
      desc="Dùng để điền sẵn khi ứng tuyển và kiểm tra điều kiện đơn."
      action={!preview && !editing && <EditButton onClick={() => (setD(init()), s.reset(), setEditing(true))} />}
    >
      {!editing ? (
        <>
          {!preview && avatar}
          <InfoGrid
            items={[
              ['Họ và tên', profile.name],
              ['Năm sinh', profile.birthYear ? `${profile.birthYear} (${age} tuổi)` : null],
              ['Giới tính', profile.gender ? GENDER_LABEL[profile.gender] : null],
              ['Số điện thoại / Zalo', profile.phone ? (preview && profile.discoverable ? `${displayPhone(profile.phone).slice(0, 4)} xxx ${profile.phone.slice(-3)}` : displayPhone(profile.phone)) : null],
              ['Quê quán', profile.hometown],
              ['Chiều cao · Cân nặng', profile.heightCm || profile.weightKg ? [profile.heightCm && `${profile.heightCm} cm`, profile.weightKg && `${profile.weightKg} kg`].filter(Boolean).join(' · ') : null],
              ['Thị lực', profile.eyesight],
              ['Tình trạng hôn nhân', profile.maritalStatus ? MARITAL_LABEL[profile.maritalStatus] : null],
              ['Hình xăm', profile.tattoo === null ? null : profile.tattoo ? 'Có' : 'Không'],
              ...(!preview ? ([['Email', profile.email]] as Array<[string, ReactNode]>) : []),
            ]}
          />
          {profile.about && <p className="sp-about">“{profile.about}”</p>}
        </>
      ) : (
        <form className="sp-form" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
          <div className="ef-grid ef-grid--3">
            <Field label="Họ và tên" required error={s.fields.name}>
              <input className={cx('ef-input', s.fields.name && 'ef-input--invalid')} value={d.name} maxLength={80} aria-invalid={!!s.fields.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Năm sinh" required error={s.fields.birthYear} extra={Number(d.birthYear) > 1940 ? `${YEAR - Number(d.birthYear)} tuổi` : undefined}>
              <input className={cx('ef-input', s.fields.birthYear && 'ef-input--invalid')} inputMode="numeric" maxLength={4} value={d.birthYear} aria-invalid={!!s.fields.birthYear} onChange={(e) => set('birthYear', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Giới tính" required error={s.fields.gender}>
              <OptionGroup label="Giới tính" options={[{ value: 'nu', label: 'Nữ' }, { value: 'nam', label: 'Nam' }]} value={d.gender} onChange={(v) => set('gender', v)} invalid={!!s.fields.gender} />
            </Field>
            <Field label="Số điện thoại / Zalo" hint="Đổi số điện thoại cần xác thực OTP – liên hệ cán bộ tư vấn">
              <input className="ef-input" value={profile.phone ? displayPhone(profile.phone) : ''} disabled />
            </Field>
            <Field label="Email" error={s.fields.email}>
              <input className={cx('ef-input', s.fields.email && 'ef-input--invalid')} type="email" value={d.email} maxLength={120} placeholder="Không bắt buộc" aria-invalid={!!s.fields.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Quê quán">
              <Select className="field-input field-input--select ef-select" aria-label="Quê quán" placeholder="Chọn tỉnh" value={d.hometown} onChange={(v) => set('hometown', v)} options={VN_PROVINCES.map((p) => ({ value: p, label: p }))} />
            </Field>
            <Field label="Chiều cao" error={s.fields.heightCm}>
              <span className="ef-affix">
                <input className={cx('ef-input', s.fields.heightCm && 'ef-input--invalid')} inputMode="numeric" maxLength={3} value={d.heightCm} onChange={(e) => set('heightCm', e.target.value.replace(/\D/g, ''))} />
                <span className="ef-affix__unit">cm</span>
              </span>
            </Field>
            <Field label="Cân nặng" error={s.fields.weightKg}>
              <span className="ef-affix">
                <input className={cx('ef-input', s.fields.weightKg && 'ef-input--invalid')} inputMode="numeric" maxLength={3} value={d.weightKg} onChange={(e) => set('weightKg', e.target.value.replace(/\D/g, ''))} />
                <span className="ef-affix__unit">kg</span>
              </span>
            </Field>
            <Field label="Thị lực">
              <input className="ef-input" value={d.eyesight} maxLength={60} placeholder="VD: 10/10, không mù màu" onChange={(e) => set('eyesight', e.target.value)} />
            </Field>
            <Field label="Tình trạng hôn nhân">
              <OptionGroup label="Tình trạng hôn nhân" size="sm" options={MARITAL_STATUSES.map((m) => ({ value: m, label: MARITAL_LABEL[m] }))} value={d.maritalStatus} onChange={(v) => set('maritalStatus', v)} />
            </Field>
            <Field label="Hình xăm">
              <OptionGroup label="Hình xăm" size="sm" options={[{ value: 'no', label: 'Không' }, { value: 'yes', label: 'Có' }]} value={d.tattoo} onChange={(v) => set('tattoo', v)} />
            </Field>
            <Field label="Địa chỉ hiện tại">
              <input className="ef-input" value={d.address} maxLength={200} placeholder="Xã / phường, huyện, tỉnh" onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
          <Field label="Giới thiệu bản thân" extra={`${d.about.length}/1000`}>
            <textarea className="ef-input" rows={3} value={d.about} maxLength={1000} placeholder="VD: Chăm chỉ, khéo tay, đã quen làm theo ca…" onChange={(e) => set('about', e.target.value)} />
          </Field>
          <EditActions busy={s.busy} error={s.error} onCancel={() => setEditing(false)} />
        </form>
      )}
    </SectionCard>
  );
}

/* ---------- 2. Nguyện vọng ---------- */
export function WishesSection({ profile, save, preview }: { profile: SeekerProfile; save: SaveProfile; preview: boolean }) {
  const [editing, setEditing] = useState(false);
  const init = () => ({
    programs: profile.programs,
    industries: profile.industries,
    prefs: profile.prefs,
    desiredSalary: profile.desiredSalary ? String(profile.desiredSalary) : '',
    departWithin: profile.departWithin ?? '',
    maxFeeUsd: profile.maxFeeUsd ? String(profile.maxFeeUsd) : '',
  });
  const [d, setD] = useState(init);
  const s = useSaver(save, () => setEditing(false));

  const submit = () => {
    const e: Errors = {};
    if (!d.programs.length) e.programs = 'Chọn ít nhất 1 chương trình';
    if (!d.industries.length) e.industries = 'Chọn ít nhất 1 ngành nghề';
    if (d.prefs.length > 20) e.prefs = 'Tối đa 20 tỉnh';
    void s.run(
      {
        programs: d.programs,
        industries: d.industries,
        prefs: d.prefs,
        desiredSalary: numOrNull(d.desiredSalary),
        departWithin: (d.departWithin || null) as SeekerProfile['departWithin'],
        maxFeeUsd: numOrNull(d.maxFeeUsd),
      },
      e,
    );
  };
  const togglePrefs = (region: (typeof REGIONS)[number]) => {
    const all = PREFECTURES_BY_REGION[region];
    const on = all.every((p) => d.prefs.includes(p));
    setD((x) => ({ ...x, prefs: on ? x.prefs.filter((p) => !all.includes(p)) : [...new Set([...x.prefs, ...all])] }));
  };

  return (
    <SectionCard
      id="nguyen-vong"
      icon={<IconPin size={18} />}
      tone="orange"
      title="Nguyện vọng"
      desc="viecpro gợi ý việc làm và gửi thông báo dựa trên mục này."
      action={!preview && !editing && <EditButton onClick={() => (setD(init()), s.reset(), setEditing(true))} />}
    >
      {!editing ? (
        <InfoGrid
          items={[
            ['Chương trình', profile.programs.map((p) => PROGRAM_LABEL[p]).join(', ')],
            ['Ngành nghề', profile.industries.join(', ')],
            ['Khu vực mong muốn', prefsSummary(profile.prefs)],
            ['Lương mong muốn', profile.desiredSalary ? `Từ ${yen(profile.desiredSalary)}/tháng` : null],
            ['Có thể xuất cảnh', profile.departWithin ? DEPART_WITHIN_LABEL[profile.departWithin] : null],
            ['Chi phí xuất cảnh', profile.maxFeeUsd ? `Tối đa ${profile.maxFeeUsd.toLocaleString('vi-VN')} USD` : null],
          ]}
        />
      ) : (
        <form className="sp-form" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
          <Field label="Chương trình" required error={s.fields.programs}>
            <div className="sp-chips">
              {PROGRAMS.map((p) => (
                <CheckCard key={p} checked={d.programs.includes(p)} onChange={() => setD((x) => ({ ...x, programs: toggleIn(x.programs, p) }))}>
                  {PROGRAM_LABEL[p]}
                </CheckCard>
              ))}
            </div>
          </Field>
          <Field label="Ngành nghề" required error={s.fields.industries}>
            <div className="sp-chips">
              {INDUSTRIES.map((i) => (
                <CheckCard key={i} checked={d.industries.includes(i)} onChange={() => setD((x) => ({ ...x, industries: toggleIn(x.industries, i) }))}>
                  {i}
                </CheckCard>
              ))}
            </div>
          </Field>
          <Field label="Khu vực mong muốn" extra={`${d.prefs.length} tỉnh`} error={s.fields.prefs}>
            <div className="sp-regions">
              {REGIONS.map((r) => (
                <div key={r} className="sp-region">
                  <button type="button" className={cx('sp-region__name', PREFECTURES_BY_REGION[r].every((p) => d.prefs.includes(p)) && 'sp-region__name--on')} onClick={() => togglePrefs(r)}>
                    {REGION_LABEL[r]}
                  </button>
                  <span className="sp-region__prefs">
                    {PREFECTURES_BY_REGION[r].map((p) => (
                      <button key={p} type="button" aria-pressed={d.prefs.includes(p)} className={cx('sp-pref', d.prefs.includes(p) && 'sp-pref--on')} onClick={() => setD((x) => ({ ...x, prefs: toggleIn(x.prefs, p) }))}>
                        {p}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Field>
          <div className="ef-grid ef-grid--3">
            <Field label="Lương mong muốn (tối thiểu)" error={s.fields.desiredSalary}>
              <span className="ef-affix">
                <input className="ef-input" inputMode="numeric" maxLength={7} value={d.desiredSalary} placeholder="VD: 175000" onChange={(e) => setD((x) => ({ ...x, desiredSalary: e.target.value.replace(/\D/g, '') }))} />
                <span className="ef-affix__unit">¥/tháng</span>
              </span>
            </Field>
            <Field label="Có thể xuất cảnh">
              <OptionGroup label="Có thể xuất cảnh" size="sm" options={Object.entries(DEPART_WITHIN_LABEL).map(([value, label]) => ({ value, label: label.replace('Trong ', '') }))} value={d.departWithin} onChange={(v) => setD((x) => ({ ...x, departWithin: v }))} />
            </Field>
            <Field label="Chi phí xuất cảnh tối đa" error={s.fields.maxFeeUsd}>
              <span className="ef-affix">
                <input className="ef-input" inputMode="numeric" maxLength={5} value={d.maxFeeUsd} placeholder="VD: 5000" onChange={(e) => setD((x) => ({ ...x, maxFeeUsd: e.target.value.replace(/\D/g, '') }))} />
                <span className="ef-affix__unit">USD</span>
              </span>
            </Field>
          </div>
          <EditActions busy={s.busy} error={s.error} onCancel={() => setEditing(false)} />
        </form>
      )}
    </SectionCard>
  );
}

/* ---------- 3. Kinh nghiệm & học vấn ---------- */
const EMPTY_EXP: SeekerExperience = { kind: 'work', title: '', org: '', from: '', to: null, desc: '', tags: [] };

export function ExperienceSection({ profile, save, preview }: { profile: SeekerProfile; save: SaveProfile; preview: boolean }) {
  // index đang sửa; -1 = thêm mới
  const [editing, setEditing] = useState<number | null>(null);
  const [d, setD] = useState<SeekerExperience & { tagText: string }>({ ...EMPTY_EXP, tagText: '' });
  const s = useSaver(save, () => setEditing(null));
  const list = profile.experiences;

  const open = (i: number) => {
    const e = i >= 0 ? list[i]! : EMPTY_EXP;
    setD({ ...e, tagText: e.tags.join(', ') });
    s.reset();
    setEditing(i);
  };
  const remove = (i: number) => {
    if (!window.confirm(`Xoá “${list[i]!.title}” khỏi hồ sơ?`)) return;
    void s.run({ experiences: list.filter((_, k) => k !== i) });
  };
  const submit = () => {
    const e: Errors = {};
    const ym = /^(19|20)\d{2}(-(0[1-9]|1[0-2]))?$/;
    if (d.title.trim().length < 2) e.title = d.kind === 'work' ? 'Nhập vị trí công việc' : 'Nhập bằng cấp / khoá học';
    if (!ym.test(d.from)) e.from = 'Chọn thời gian bắt đầu';
    if (d.to && !ym.test(d.to)) e.to = 'Thời gian chưa đúng';
    if (d.to && d.from && d.to < d.from) e.to = 'Phải sau thời gian bắt đầu';
    const item: SeekerExperience = { kind: d.kind, title: d.title.trim(), org: d.org.trim(), from: d.from, to: d.to, desc: d.desc.trim(), tags: d.tagText.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6) };
    void s.run({ experiences: editing === -1 ? [...list, item] : list.map((x, k) => (k === editing ? item : x)) }, e);
  };

  return (
    <SectionCard
      id="kinh-nghiem"
      icon={<IconBriefcase size={18} />}
      tone="green"
      title="Kinh nghiệm & học vấn"
      desc="Kinh nghiệm thực tế giúp tăng % phù hợp với đơn cùng ngành."
      action={!preview && editing === null && list.length < 15 && <EditButton icon="plus" label="Thêm" onClick={() => open(-1)} />}
    >
      {editing !== null ? (
        <form className="sp-form" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
          <OptionGroup label="Loại" size="sm" options={[{ value: 'work', label: 'Kinh nghiệm làm việc' }, { value: 'education', label: 'Học vấn' }]} value={d.kind} onChange={(v) => setD((x) => ({ ...x, kind: v }))} />
          <div className="ef-grid">
            <Field label={d.kind === 'work' ? 'Vị trí công việc' : 'Bằng cấp / khoá học'} required error={s.fields.title}>
              <input className={cx('ef-input', s.fields.title && 'ef-input--invalid')} value={d.title} maxLength={80} placeholder={d.kind === 'work' ? 'VD: Công nhân may' : 'VD: Tốt nghiệp THPT'} aria-invalid={!!s.fields.title} onChange={(e) => setD((x) => ({ ...x, title: e.target.value }))} />
            </Field>
            <Field label={d.kind === 'work' ? 'Công ty · nơi làm' : 'Trường'}>
              <input className="ef-input" value={d.org} maxLength={120} onChange={(e) => setD((x) => ({ ...x, org: e.target.value }))} />
            </Field>
            <Field label="Từ" required error={s.fields.from}>
              <input className={cx('ef-input', s.fields.from && 'ef-input--invalid')} type="month" value={d.from.length === 7 ? d.from : d.from ? `${d.from}-01` : ''} max={`${YEAR}-12`} aria-invalid={!!s.fields.from} onChange={(e) => setD((x) => ({ ...x, from: e.target.value }))} />
            </Field>
            <Field label="Đến" error={s.fields.to}>
              <span className="sp-to">
                <input className={cx('ef-input', s.fields.to && 'ef-input--invalid')} type="month" value={d.to ? (d.to.length === 7 ? d.to : `${d.to}-12`) : ''} disabled={!d.to} max={`${YEAR}-12`} onChange={(e) => setD((x) => ({ ...x, to: e.target.value || null }))} />
                <CheckCard checked={!d.to} onChange={() => setD((x) => ({ ...x, to: x.to ? null : x.from || `${YEAR}-01` }))}>
                  Đến nay
                </CheckCard>
              </span>
            </Field>
          </div>
          <Field label="Mô tả công việc" extra={`${d.desc.length}/500`}>
            <textarea className="ef-input" rows={3} value={d.desc} maxLength={500} onChange={(e) => setD((x) => ({ ...x, desc: e.target.value }))} />
          </Field>
          <Field label="Kỹ năng rút ra" hint="Cách nhau bằng dấu phẩy, tối đa 6">
            <input className="ef-input" value={d.tagText} maxLength={200} placeholder="VD: Làm theo ca, Kiểm tra chất lượng" onChange={(e) => setD((x) => ({ ...x, tagText: e.target.value }))} />
          </Field>
          <EditActions busy={s.busy} error={s.error} onCancel={() => setEditing(null)} />
        </form>
      ) : list.length ? (
        <ol className="sp-timeline">
          {list.map((e, i) => (
            <li key={`${e.title}-${e.from}`} className={cx('sp-timeline__item', e.kind === 'education' && 'sp-timeline__item--edu')}>
              <span className="sp-timeline__icon">{e.kind === 'work' ? <IconBriefcase size={15} /> : <IconGraduation size={15} />}</span>
              <div className="sp-timeline__body">
                <span className="sp-timeline__head">
                  <b>{e.title}</b>
                  <span className="sp-timeline__time">{experienceRange(e)}</span>
                </span>
                {e.org && <span className="sp-timeline__org">{e.org}</span>}
                {e.desc && <p className="sp-timeline__desc">{e.desc}</p>}
                {e.tags.length > 0 && (
                  <span className="sp-tags">
                    {e.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </span>
                )}
              </div>
              {!preview && (
                <span className="sp-timeline__tools">
                  <button type="button" aria-label={`Sửa ${e.title}`} onClick={() => open(i)}>
                    <IconEdit size={14} />
                  </button>
                  <button type="button" aria-label={`Xoá ${e.title}`} onClick={() => remove(i)} disabled={s.busy}>
                    <IconCloseSmall size={14} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="sp-empty">Chưa có kinh nghiệm. Thêm công việc đã làm (kể cả làm thêm, làm ruộng, may mặc tại nhà…) để tăng % phù hợp.</p>
      )}
      {editing === null && s.error && (
        <span className="sp-form__error" role="alert">
          {s.error}
        </span>
      )}
    </SectionCard>
  );
}

/* ---------- 4. Tiếng Nhật & kỹ năng ---------- */
export function SkillsSection({ profile, save, preview }: { profile: SeekerProfile; save: SaveProfile; preview: boolean }) {
  const [editing, setEditing] = useState(false);
  const init = () => ({ jlpt: (profile.jlpt ?? '') as JlptLevel | '', jlptLearning: (profile.jlptLearning ?? '') as JlptLevel | '', skills: profile.skills.map((x) => ({ ...x })) });
  const [d, setD] = useState(init);
  const s = useSaver(save, () => setEditing(false));
  const level = (profile.jlpt ?? profile.jlptLearning) as JlptLevel | null;
  const levelIndex = level ? JLPT_LEVELS.indexOf(level) : -1;

  const setSkill = (i: number, patch: Partial<SeekerSkill>) => setD((x) => ({ ...x, skills: x.skills.map((sk, k) => (k === i ? { ...sk, ...patch } : sk)) }));
  const submit = () => {
    const e: Errors = {};
    const skills = d.skills.filter((sk) => sk.name.trim());
    if (skills.some((sk) => sk.name.trim().length < 2)) e.skills = 'Tên kỹ năng tối thiểu 2 ký tự';
    void s.run({ jlpt: d.jlpt || null, jlptLearning: d.jlpt ? null : d.jlptLearning || null, skills: skills.map(({ name, level: lv, note }) => ({ name: name.trim(), level: lv, note: note?.trim() || null })) }, e);
  };

  return (
    <SectionCard
      id="ky-nang"
      icon={<IconChatSquare size={18} />}
      tone="violet"
      title="Tiếng Nhật & kỹ năng"
      desc="Nhà tuyển dụng lọc hồ sơ theo trình độ tiếng Nhật và tay nghề."
      action={!preview && !editing && <EditButton onClick={() => (setD(init()), s.reset(), setEditing(true))} />}
    >
      {!editing ? (
        <>
          <div className="sp-jlpt">
            <div className="sp-jlpt__top">
              <span className="sp-jlpt__text">
                <b>{profile.jlpt ? `Đã có chứng chỉ ${profile.jlpt}` : profile.jlptLearning ? `Đang học ${profile.jlptLearning} · chưa có chứng chỉ` : 'Chưa học tiếng Nhật'}</b>
                <small>{profile.jlpt ? 'Đơn yêu cầu tiếng Nhật sẽ ưu tiên hồ sơ của bạn' : `Làm bài test để hiển thị trình độ thật – đơn yêu cầu ${profile.jlptLearning ?? 'N5'} sẽ ưu tiên bạn`}</small>
              </span>
              {!preview && !profile.jlpt && (
                // Chưa có API: bài kiểm tra tiếng Nhật 10 phút
                <button type="button" className="btn btn--primary btn--sm sp-jlpt__test" disabled title="Sắp ra mắt">
                  <IconClock size={14} />
                  Làm bài kiểm tra 10 phút
                </button>
              )}
            </div>
            <ol className="sp-jlpt__levels" aria-label="Trình độ tiếng Nhật">
              {JLPT_LEVELS.map((l, i) => (
                <li key={l} className={cx(i <= levelIndex && 'sp-jlpt__level--on', i === levelIndex && 'sp-jlpt__level--current')}>
                  <span className="sp-jlpt__bar" />
                  <span>
                    {l}
                    {i === levelIndex ? (profile.jlpt ? ' · Đã đạt' : ' · Đang học') : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {profile.skills.length ? (
            <ul className="sp-skills">
              {profile.skills.map((sk) => (
                <li key={sk.name} className="sp-skill">
                  <span className="sp-skill__text">
                    <b>{sk.name}</b>
                    <small className={cx(sk.verified && 'sp-skill__verified')}>{sk.verified ? `✓ ${sk.note ?? 'Đã được cán bộ tư vấn xác nhận'}` : (sk.note ?? 'Tự đánh giá')}</small>
                  </span>
                  <span className="sp-dots" role="img" aria-label={`Mức ${sk.level}/5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i key={n} className={cx(n <= sk.level && 'sp-dots__on')} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sp-empty">Thêm kỹ năng nổi bật (khéo tay, làm ca đêm, lái xe nâng…) để nhà tuyển dụng dễ chọn bạn.</p>
          )}
        </>
      ) : (
        <form className="sp-form" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
          <div className="ef-grid">
            <Field label="Chứng chỉ JLPT">
              <OptionGroup label="Chứng chỉ JLPT" size="sm" options={[{ value: '', label: 'Chưa có' } as { value: JlptLevel | ''; label: string }, ...JLPT_LEVELS.map((l) => ({ value: l, label: l }))]} value={d.jlpt} onChange={(v) => setD((x) => ({ ...x, jlpt: v }))} />
            </Field>
            {!d.jlpt && (
              <Field label="Đang học">
                <OptionGroup label="Đang học" size="sm" options={[{ value: '', label: 'Chưa học' } as { value: JlptLevel | ''; label: string }, ...JLPT_LEVELS.map((l) => ({ value: l, label: l }))]} value={d.jlptLearning} onChange={(v) => setD((x) => ({ ...x, jlptLearning: v }))} />
              </Field>
            )}
          </div>
          <Field label="Kỹ năng" extra={`${d.skills.length}/12`} error={s.fields.skills} hint="Kỹ năng đã được cán bộ xác nhận giữ nguyên dấu xác nhận nếu bạn không đổi tên">
            <ul className="sp-skill-edit">
              {d.skills.map((sk, i) => (
                <li key={i}>
                  <input className="ef-input" value={sk.name} maxLength={60} placeholder="Tên kỹ năng" aria-label={`Kỹ năng ${i + 1}`} onChange={(e) => setSkill(i, { name: e.target.value })} />
                  <input className="ef-input sp-skill-edit__note" value={sk.note ?? ''} maxLength={60} placeholder="Ghi chú (VD: 3 năm)" aria-label={`Ghi chú kỹ năng ${i + 1}`} onChange={(e) => setSkill(i, { note: e.target.value })} />
                  <span className="sp-dots sp-dots--edit" role="radiogroup" aria-label={`Mức kỹ năng ${i + 1}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={sk.level === n} aria-label={`Mức ${n}`} className={cx(n <= sk.level && 'sp-dots__on')} onClick={() => setSkill(i, { level: n })} />
                    ))}
                  </span>
                  <button type="button" className="ef-tag__remove" aria-label={`Bỏ kỹ năng ${sk.name || i + 1}`} onClick={() => setD((x) => ({ ...x, skills: x.skills.filter((_, k) => k !== i) }))}>
                    <IconCloseSmall size={12} className="icon--w26" />
                  </button>
                </li>
              ))}
            </ul>
            {d.skills.length < 12 && (
              <button type="button" className="sp-add" onClick={() => setD((x) => ({ ...x, skills: [...x.skills, { name: '', level: 3, note: null, verified: false }] }))}>
                <IconPlus size={14} />
                Thêm kỹ năng
              </button>
            )}
          </Field>
          <EditActions busy={s.busy} error={s.error} onCancel={() => setEditing(false)} />
        </form>
      )}
    </SectionCard>
  );
}
