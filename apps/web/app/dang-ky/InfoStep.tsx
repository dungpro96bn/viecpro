'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PROGRAM_LABEL, cx } from '@/lib/format';
import type { Program } from '@/lib/types';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialLogin from '@/components/auth/SocialLogin';
import Select from '@/components/ui/Select';
import { IconArrowRight, IconBuilding, IconCheck, IconMinus, IconUserCheck, IconUserRound } from '@/components/ui/Icons';

type Role = 'seeker' | 'employer';

export interface RegisterInfo {
  role: Role;
  name: string;
  phone: string;
  birthYear: string;
  gender: 'nam' | 'nu';
  programs: Program[];
  company: string;
  password: string;
}

const ROLES = [
  { key: 'seeker' as const, title: 'Người tìm việc', desc: 'Tìm đơn Nhật Bản, ứng tuyển và theo dõi hồ sơ', icon: IconUserCheck },
  { key: 'employer' as const, title: 'Nhà tuyển dụng', desc: 'Đăng đơn hàng, nhận hồ sơ ứng viên đã sàng lọc', icon: IconBuilding },
];

const PROGRAMS: { key: Program; label: string }[] = [
  { key: 'tts', label: PROGRAM_LABEL.tts },
  { key: 'tok', label: PROGRAM_LABEL.tok },
  { key: 'ks', label: 'Kỹ sư – Trí thức' },
];

const YEARS = Array.from({ length: 2007 - 1975 + 1 }, (_, i) => 2007 - i);

const PASSWORD_RULES = [
  { label: '8+ ký tự', test: (v: string) => v.length >= 8 },
  { label: 'Có chữ số', test: (v: string) => /\d/.test(v) },
  { label: 'Chữ hoa & thường', test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
];
const STRENGTH_LABEL = ['Độ mạnh', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'];

/** 0–4: mỗi quy tắc đạt được +1, thêm +1 nếu có ký tự đặc biệt */
function passwordScore(v: string) {
  if (!v) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(v)).length + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
  return Math.max(1, passed);
}

type Field = 'name' | 'phone' | 'birthYear' | 'company' | 'password' | 'agree';
type Errors = Partial<Record<Field, string>>;

const EMPTY: RegisterInfo = { role: 'seeker', name: '', phone: '', birthYear: '', gender: 'nam', programs: ['tts'], company: '', password: '' };

function validate(f: RegisterInfo, agree: boolean): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = 'Vui lòng nhập họ và tên';
  const digits = f.phone.replace(/\D/g, '').replace(/^0/, '');
  if (!digits) errors.phone = 'Vui lòng nhập số điện thoại';
  else if (digits.length !== 9) errors.phone = 'Số điện thoại chưa đúng';
  if (f.role === 'seeker' && !f.birthYear) errors.birthYear = 'Vui lòng chọn năm sinh';
  if (f.role === 'employer' && !f.company.trim()) errors.company = 'Vui lòng nhập tên công ty';
  if (!PASSWORD_RULES.every((r) => r.test(f.password))) errors.password = 'Mật khẩu chưa đủ điều kiện bên dưới';
  if (!agree) errors.agree = 'Bạn cần đồng ý điều khoản để tiếp tục';
  return errors;
}

/** Bước 1: chọn vai trò và nhập thông tin */
export default function InfoStep({ initial, onNext }: { initial: RegisterInfo | null; onNext: (info: RegisterInfo) => Promise<void> }) {
  const [form, setForm] = useState<RegisterInfo>(initial ?? EMPTY);
  const [agree, setAgree] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field: string) => setErrors((e) => (field in e ? { ...e, [field]: undefined } : e));
  const set = <K extends keyof RegisterInfo>(key: K, value: RegisterInfo[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key);
  };
  const toggleProgram = (p: Program) =>
    set('programs', form.programs.includes(p) ? form.programs.filter((x) => x !== p) : [...form.programs, p]);

  const score = passwordScore(form.password);
  const isSeeker = form.role === 'seeker';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validate(form, agree);
    setErrors(next);
    setSubmitError('');
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await onNext(form);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const error = (field: Field) =>
    errors[field] && (
      <span id={`reg-${field}-error`} className="auth-field__error">
        {errors[field]}
      </span>
    );
  const describedBy = (field: Field) => (errors[field] ? `reg-${field}-error` : undefined);

  return (
    <form className="reg-form" noValidate onSubmit={onSubmit}>
      <div className="reg-form__intro">
        <div className="auth-form__head reg-form__head">
          <h1 className="auth-form__title reg-form__title">Tạo tài khoản miễn phí</h1>
          <p className="auth-form__lead">Chọn vai trò để viecpro gợi ý đúng những gì bạn cần.</p>
        </div>

        <div className="role-cards" role="radiogroup" aria-label="Bạn là">
          {ROLES.map(({ key, title, desc, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={form.role === key}
              className={cx('role-card', form.role === key && 'role-card--active')}
              onClick={() => set('role', key)}
            >
              <span className="role-card__icon">
                <Icon size={21} />
              </span>
              <span className="role-card__text">
                <span className="role-card__title">{title}</span>
                <span className="role-card__desc">{desc}</span>
              </span>
              <span className="role-card__radio" />
            </button>
          ))}
        </div>

        <div className="reg-grid">
          <label className="auth-field">
            <span className="auth-field__label">
              <span>
                {isSeeker ? 'Họ và tên' : 'Người liên hệ'}
                <span className="auth-field__req">*</span>
              </span>
            </span>
            <span className={cx('auth-input auth-input--compact', errors.name && 'auth-input--invalid')}>
              <IconUserRound size={18} className="auth-input__icon" />
              <input
                className="auth-input__control"
                type="text"
                name="fullName"
                autoComplete="name"
                placeholder="Nguyễn Thị Lan"
                value={form.name}
                aria-invalid={!!errors.name || undefined}
                aria-describedby={describedBy('name')}
                onChange={(e) => set('name', e.target.value)}
              />
            </span>
            {error('name')}
          </label>

          <label className="auth-field">
            <span className="auth-field__label">
              <span>
                Số điện thoại / Zalo<span className="auth-field__req">*</span>
              </span>
            </span>
            <span className={cx('auth-input auth-input--compact', errors.phone && 'auth-input--invalid')}>
              <span className="auth-input__prefix">+84</span>
              <input
                className="auth-input__control"
                type="tel"
                name="phone"
                autoComplete="tel-national"
                inputMode="tel"
                placeholder="912 345 678"
                value={form.phone}
                aria-invalid={!!errors.phone || undefined}
                aria-describedby={describedBy('phone')}
                onChange={(e) => set('phone', e.target.value)}
              />
            </span>
            {error('phone')}
          </label>
        </div>

        {isSeeker ? (
          <div className="reg-form__group">
            <div className="reg-grid">
              <label className="auth-field">
                <span className="auth-field__label">
                  <span>
                    Năm sinh<span className="auth-field__req">*</span>
                  </span>
                </span>
                <Select
                  className={cx('auth-input auth-input--compact reg-select', errors.birthYear && 'auth-input--invalid')}
                  name="birthYear"
                  aria-label="Năm sinh"
                  placeholder="Chọn năm sinh"
                  options={YEARS}
                  value={form.birthYear}
                  onChange={(v) => set('birthYear', v)}
                />
                {error('birthYear')}
              </label>

              <div className="auth-field">
                <span className="auth-field__label">Giới tính</span>
                <div className="auth-segmented auth-segmented--sm" role="radiogroup" aria-label="Giới tính">
                  {(['nam', 'nu'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={form.gender === g}
                      className={cx('auth-segmented__option', form.gender === g && 'auth-segmented__option--active')}
                      onClick={() => set('gender', g)}
                    >
                      {g === 'nam' ? 'Nam' : 'Nữ'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="auth-field reg-programs">
              <span className="auth-field__label">
                <span>Chương trình quan tâm</span>
                <span className="auth-field__hint">Chọn nhiều</span>
              </span>
              <div className="reg-chips">
                {PROGRAMS.map(({ key, label }) => {
                  const on = form.programs.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      className={cx('reg-chip', on && 'reg-chip--active')}
                      onClick={() => toggleProgram(key)}
                    >
                      {on && <IconCheck size={13} className="icon--w3" />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <label className="auth-field">
            <span className="auth-field__label">
              <span>
                Tên công ty / đơn vị<span className="auth-field__req">*</span>
              </span>
            </span>
            <span className={cx('auth-input auth-input--compact', errors.company && 'auth-input--invalid')}>
              <IconBuilding size={18} className="auth-input__icon" />
              <input
                className="auth-input__control"
                type="text"
                name="company"
                autoComplete="organization"
                placeholder="Công ty CP Nhân lực Quốc tế ABC"
                value={form.company}
                aria-invalid={!!errors.company || undefined}
                aria-describedby={describedBy('company')}
                onChange={(e) => set('company', e.target.value)}
              />
            </span>
            {error('company')}
          </label>
        )}

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reg-password">
            <span>
              Mật khẩu<span className="auth-field__req">*</span>
            </span>
          </label>
          <PasswordInput
            id="reg-password"
            name="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            compact
            value={form.password}
            invalid={!!errors.password}
            aria-describedby={describedBy('password')}
            onChange={(e) => set('password', e.target.value)}
          />
          <span className={cx('pw-meter', `pw-meter--${score}`)} aria-live="polite">
            <span className="pw-meter__bars">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={cx('pw-meter__bar', n <= score && 'pw-meter__bar--on')} />
              ))}
            </span>
            <span className="pw-meter__label">{STRENGTH_LABEL[score]}</span>
          </span>
          <span className="pw-rules">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(form.password);
              return (
                <span key={r.label} className={cx('pw-rules__item', ok && 'pw-rules__item--ok')}>
                  {ok ? <IconCheck size={13} className="icon--w26" /> : <IconMinus size={13} className="icon--w26" />}
                  {r.label}
                </span>
              );
            })}
          </span>
          {error('password')}
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-check auth-check--top">
          <input
            className="auth-check__box"
            type="checkbox"
            checked={agree}
            aria-describedby={describedBy('agree')}
            onChange={(e) => {
              setAgree(e.target.checked);
              clearError('agree');
            }}
          />
          <span>
            Tôi đồng ý với <Link href="#">Điều khoản sử dụng</Link> và <Link href="#">Chính sách bảo mật</Link>, đồng ý nhận thông báo đơn hàng
            qua Zalo.
          </span>
        </label>
        {error('agree')}
      </div>

      {submitError && <p className="auth-field__error" role="alert">{submitError}</p>}
      <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={submitting}>
        {submitting ? 'Đang gửi mã xác thực…' : 'Tiếp tục'}
        <IconArrowRight size={18} className="icon--w22" />
      </button>

      <SocialLogin label="Đăng ký nhanh với Google" />
    </form>
  );
}
