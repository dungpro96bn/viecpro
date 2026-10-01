'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { ApplyJob } from '@/lib/types';
import { PROGRAM_LABEL, cx, formatYen } from '@/lib/format';
import Avatar from '../ui/Avatar';
import Stars from '../ui/Stars';
import Select from '../ui/Select';
import {
  IconArrowLeft,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconClose,
  IconLock,
  IconMail,
  IconPhone,
  IconPin,
  IconSend,
  IconShieldCheck,
} from '../ui/Icons';
import './apply-modal.css';
import type { EmailOtpSentResponse } from '@viecpro/shared';
import { useAuth } from '@/components/auth/AuthProvider';
import { ApiClientError, apiRequest, apiMessage } from '@/lib/api';
import OtpInput from './OtpInput';

const YEARS = Array.from({ length: 2007 - 1975 + 1 }, (_, i) => 2007 - i);

const PERKS = [
  { icon: IconClock, title: 'Gọi lại trong 30 phút', desc: 'Trong giờ hành chính, kể cả thứ 7' },
  { icon: IconCheckCircle, title: 'Tư vấn hoàn toàn miễn phí', desc: 'Không thu bất kỳ khoản nào khi đăng ký' },
  { icon: IconLock, title: 'Bảo mật thông tin', desc: 'Chỉ cán bộ phụ trách đơn được xem hồ sơ' },
];

interface ApplyModalProps {
  job: ApplyJob;
  onClose: () => void;
}

export default function ApplyModal({ job, onClose }: ApplyModalProps) {
  const { user } = useAuth();
  const seeker = user?.role === 'seeker' ? user : null;
  const [gender, setGender] = useState<'nam' | 'nu'>('nam');
  const [form, setForm] = useState({ fullName: seeker?.name ?? '', email: seeker?.email ?? '', phone: seeker?.phone?.replace(/^\+84/, '0') ?? '', birthYear: '', address: '', note: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [agree, setAgree] = useState(true);
  const [step, setStep] = useState<'form' | 'code' | 'sent'>('form');
  const [otp, setOtp] = useState<EmailOtpSentResponse | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [wait, setWait] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  // Đếm ngược "gửi lại mã"
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const validate = () => {
    const e: typeof errors = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Vui lòng nhập họ và tên';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Nhập email để nhận mã xác nhận';
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = 'Số điện thoại chưa đúng';
    if (!form.birthYear) e.birthYear = 'Chọn năm sinh';
    return e;
  };

  /** Áp lỗi trả về từ API vào đúng ô */
  const applyApiError = (error: unknown, fallback: string) => {
    if (error instanceof ApiClientError && error.fields) {
      if (error.fields.emailCode) return setCodeError(error.fields.emailCode);
      const mapped = Object.fromEntries(Object.entries(error.fields).filter(([k]) => k in form));
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        setStep('form');
        return;
      }
    }
    setSubmitError(apiMessage(error, fallback));
  };

  /** Bước 1: gửi mã tới email (tài khoản đã xác thực email này thì gửi hồ sơ luôn) */
  const requestCode = async (resend = false) => {
    if (!agree || submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await apiRequest<EmailOtpSentResponse>('/applications/email-otp', { method: 'POST', body: JSON.stringify({ jobSlug: job.slug, email: form.email.trim(), fullName: form.fullName.trim() }) });
      setOtp(res);
      if (res.verified) return void (await submitApply('', true));
      setWait(res.resendAfter);
      setCode('');
      setCodeError('');
      setStep('code');
      if (resend) setSubmitError('');
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'OTP_RESEND_TOO_SOON' && otp && !resend) setStep('code');
      applyApiError(error, 'Chưa gửi được mã xác nhận. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  /** Bước 2: gửi hồ sơ kèm mã */
  const submitApply = async (value = code, verified = false) => {
    if (!verified && value.length !== 6) return setCodeError('Nhập đủ 6 số');
    setSubmitting(true);
    setSubmitError('');
    try {
      await apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify({
          jobSlug: job.slug,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone,
          birthYear: Number(form.birthYear),
          gender,
          address: form.address.trim() || undefined,
          note: form.note.trim() || undefined,
          ...(!verified && { emailCode: value }),
        }),
      });
      setStep('sent');
    } catch (error) {
      applyApiError(error, 'Không thể gửi hồ sơ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Khoá cuộn trang, đóng bằng phím Esc, focus vào popup khi mở
  useEffect(() => {
    document.body.classList.add('is-modal-open');
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('is-modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const prefLabel = `${job.pref}, Nhật Bản`;

  return (
    <div className="apply-overlay">
      <div className="apply-overlay__backdrop" onClick={onClose} aria-hidden="true" />

      <div ref={dialogRef} className="apply-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {/* Cột trái: thông tin đơn hàng */}
        <aside className="apply-modal__side">
          <span className="apply-modal__bubble apply-modal__bubble--top" />
          <span className="apply-modal__bubble apply-modal__bubble--bottom" />

          <div className="apply-job">
            <img className="apply-job__img" src={job.img} alt="" />
            <div className="apply-job__info">
              <span className="apply-job__eyebrow">Bạn đang ứng tuyển</span>
              <span className="apply-job__title">{job.title}</span>
            </div>
          </div>

          <div className="apply-facts">
            <div className="apply-facts__row apply-facts__row--top">
              <span className="apply-facts__label">Lương cơ bản</span>
              <span className="apply-facts__value apply-facts__value--lg">{formatYen(job.salary)}/tháng</span>
            </div>
            <div className="apply-facts__grid">
              <div className="apply-facts__row apply-facts__row--divider">
                <span className="apply-facts__label">Số lượng tuyển</span>
                <span className="apply-facts__value">{job.qty}</span>
              </div>
              <div className="apply-facts__row">
                <span className="apply-facts__label">Năm sinh</span>
                <span className="apply-facts__value">{job.age}</span>
              </div>
            </div>
          </div>

          <div className="apply-tags">
            <span className="apply-tags__item apply-tags__item--program">
              <IconShieldCheck size={13} className="icon--w22" />
              {PROGRAM_LABEL[job.program]}
            </span>
            <span className="apply-tags__item">
              <IconPin size={13} className="icon--w22" />
              {prefLabel}
            </span>
          </div>

          <ul className="apply-perks">
            {PERKS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="apply-perks__item">
                <span className="apply-perks__icon">
                  <Icon size={16} className="icon--w2" />
                </span>
                <span className="apply-perks__text">
                  <span className="apply-perks__title">{title}</span>
                  <span className="apply-perks__desc">{desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="apply-poster">
            <Avatar src={job.poster.photo} size={44} className="apply-poster__avatar" />
            <span className="apply-poster__info">
              <span className="apply-poster__name">{job.poster.name}</span>
              <span className="apply-poster__role">{job.poster.role}</span>
              <span className="apply-poster__rating">
                <Stars rating={job.poster.rating} size={12} tone="light" />
                <span>{job.poster.rating.toFixed(1)}</span>
              </span>
            </span>
            {/* Số riêng của cán bộ chỉ hiện ở trang hồ sơ (cần đăng nhập); không có hồ sơ thì gọi tổng đài */}
            {job.poster.href ? (
              <Link className="apply-poster__call" href={job.poster.href} aria-label={`Xem liên hệ của ${job.poster.name}`} onClick={onClose}>
                <IconPhone size={18} className="icon--w2" />
              </Link>
            ) : (
              <a className="apply-poster__call" href="tel:19006688" aria-label="Gọi tổng đài viecpro 1900 66 88">
                <IconPhone size={18} className="icon--w2" />
              </a>
            )}
          </div>
        </aside>

        {/* Cột phải: form */}
        <div className="apply-modal__main">
          <button type="button" className="apply-modal__close" aria-label="Đóng" onClick={onClose}>
            <IconClose size={18} className="icon--w2" />
          </button>

          {step === 'form' && (
            <form className="apply-form" noValidate onSubmit={(e) => (e.preventDefault(), void requestCode())}>
              <div className="apply-form__head">
                <h2 id={titleId} className="apply-form__title">
                  Ứng tuyển nhanh
                </h2>
                <p className="apply-form__lead">Chỉ mất 30 giây. Mã xác nhận sẽ được gửi tới email của bạn.</p>
              </div>

              <label className="apply-field">
                <span>
                  Họ và tên<span className="apply-field__req">*</span>
                </span>
                <input className={cx('apply-field__input', errors.fullName && 'apply-field__input--invalid')} type="text" value={form.fullName} maxLength={80} onChange={(e) => set('fullName', e.target.value)} placeholder="VD: Nguyễn Thị Lan" autoComplete="name" aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? `${titleId}-fullName` : undefined} />
                {errors.fullName && <FieldError id={`${titleId}-fullName`} text={errors.fullName} />}
              </label>

              <div className="apply-form__row">
                <label className="apply-field">
                  <span>
                    Email<span className="apply-field__req">*</span>
                  </span>
                  <input className={cx('apply-field__input', errors.email && 'apply-field__input--invalid')} type="email" value={form.email} maxLength={120} onChange={(e) => set('email', e.target.value)} placeholder="VD: lan.nguyen@gmail.com" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? `${titleId}-email` : undefined} />
                  {errors.email && <FieldError id={`${titleId}-email`} text={errors.email} />}
                </label>
                <label className="apply-field">
                  <span>
                    Số điện thoại / Zalo<span className="apply-field__req">*</span>
                  </span>
                  <input className={cx('apply-field__input', errors.phone && 'apply-field__input--invalid')} type="tel" value={form.phone} maxLength={15} onChange={(e) => set('phone', e.target.value)} placeholder="09xx xxx xxx" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${titleId}-phone` : undefined} />
                  {errors.phone && <FieldError id={`${titleId}-phone`} text={errors.phone} />}
                </label>
              </div>

              <div className="apply-form__row">
                <label className="apply-field">
                  <span>
                    Năm sinh<span className="apply-field__req">*</span>
                  </span>
                  <Select
                    className={cx('apply-field__input apply-field__input--select', errors.birthYear && 'apply-field__input--invalid')}
                    aria-label="Năm sinh"
                    placeholder="Chọn năm sinh"
                    options={YEARS}
                    value={form.birthYear}
                    onChange={(v) => set('birthYear', v)}
                  />
                  {errors.birthYear && <FieldError id={`${titleId}-birthYear`} text={errors.birthYear} />}
                </label>
                <div className="apply-field">
                  <span>Giới tính</span>
                  <div className="segmented" role="radiogroup" aria-label="Giới tính">
                    {(['nam', 'nu'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        role="radio"
                        aria-checked={gender === g}
                        className={cx('segmented__option', gender === g && 'segmented__option--active')}
                        onClick={() => setGender(g)}
                      >
                        {g === 'nam' ? 'Nam' : 'Nữ'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="apply-field">
                <span>Địa chỉ hiện tại</span>
                <input className="apply-field__input" type="text" value={form.address} maxLength={200} onChange={(e) => set('address', e.target.value)} placeholder="VD: Số nhà, xã/phường, quận/huyện, tỉnh/thành" autoComplete="street-address" />
              </label>

              <label className="apply-field">
                <span className="apply-field__label-row">
                  <span>Ghi chú</span>
                  <span className="apply-field__optional">Không bắt buộc</span>
                </span>
                <textarea className="apply-field__input apply-field__input--textarea" value={form.note} maxLength={500} onChange={(e) => set('note', e.target.value)} rows={2} placeholder="VD: Đã có hộ chiếu, muốn được gọi sau 18h…" />
              </label>

              <label className="apply-agree">
                <input type="checkbox" className="apply-agree__box" checked={agree} onChange={() => setAgree((v) => !v)} />
                <span>Tôi đồng ý để viecpro và cán bộ tuyển dụng liên hệ tư vấn về đơn hàng này.</span>
              </label>
              {submitError && <p className="apply-form__error" role="alert">{submitError}</p>}

              {/* Tablet / mobile: dính đáy popup khi cuộn form */}
              <div className="apply-form__actions">
                <button type="submit" className="btn btn--primary btn--lg apply-form__submit" disabled={!agree || submitting}>
                  <IconMail size={18} className="icon--w2" />
                  {submitting ? 'Đang gửi mã…' : 'Tiếp tục – nhận mã qua email'}
                </button>
                <span className="apply-form__trust">
                  <IconLock size={12} className="icon--w22" />
                  Miễn phí · Gọi lại trong 30 phút · Bảo mật thông tin
                </span>
              </div>
            </form>
          )}

          {step === 'code' && otp && (
            <form className="apply-form apply-otp" noValidate onSubmit={(e) => (e.preventDefault(), void submitApply())}>
              <button type="button" className="apply-otp__back" onClick={() => (setStep('form'), setSubmitError(''), setCodeError(''))}>
                <IconArrowLeft size={14} />
                Sửa thông tin
              </button>
              <span className="apply-otp__icon">
                <IconMail size={26} className="icon--w2" />
              </span>
              <div className="apply-form__head">
                <h2 id={titleId} className="apply-form__title">
                  Kiểm tra email của bạn
                </h2>
                <p className="apply-form__lead">
                  Nhập mã 6 số vừa gửi tới <b className="apply-otp__email">{otp.email}</b> để xác nhận và gửi hồ sơ.
                </p>
              </div>
              <OtpInput value={code} onChange={(v) => (setCode(v), setCodeError(''))} invalid={!!codeError} describedBy={codeError ? `${titleId}-code` : undefined} onComplete={(v) => void submitApply(v)} />
              {codeError && <FieldError id={`${titleId}-code`} text={codeError} center />}
              {otp.devCode && <p className="apply-otp__dev">Môi trường thử nghiệm – mã: <b>{otp.devCode}</b></p>}
              <p className="apply-otp__resend">
                Chưa nhận được mã? Kiểm tra mục Spam / Quảng cáo, hoặc{' '}
                {wait > 0 ? (
                  <span>gửi lại sau {wait} giây</span>
                ) : (
                  <button type="button" onClick={() => void requestCode(true)} disabled={submitting}>
                    gửi lại mã
                  </button>
                )}
              </p>
              {submitError && <p className="apply-form__error" role="alert">{submitError}</p>}
              <div className="apply-form__actions">
                <button type="submit" className="btn btn--primary btn--lg apply-form__submit" disabled={submitting || code.length !== 6}>
                  <IconSend size={18} className="icon--w2" />
                  {submitting ? 'Đang gửi hồ sơ…' : 'Xác nhận & gửi hồ sơ'}
                </button>
                <span className="apply-form__trust">
                  <IconLock size={12} className="icon--w22" />
                  Mã có hiệu lực 5 phút · Không chia sẻ mã với bất kỳ ai
                </span>
              </div>
            </form>
          )}

          {step === 'sent' && (
            <div className="apply-success">
              <span className="apply-success__icon">
                <IconCheck size={36} className="icon--w26" />
              </span>
              <h2 id={titleId} className="apply-success__title">
                Đã gửi hồ sơ thành công!
              </h2>
              <p className="apply-success__note">
                {job.poster.name} sẽ gọi lại cho bạn trong khoảng 30 phút (giờ hành chính) để tư vấn chi tiết đơn hàng.
              </p>
              <div className="apply-success__job">
                <img className="apply-success__img" src={job.img} alt="" />
                <span className="apply-success__job-text">
                  <span className="apply-success__job-title">{job.title}</span>
                  <span className="apply-success__job-pref">{prefLabel}</span>
                </span>
              </div>
              <p className="apply-success__mail">
                <IconMail size={14} className="icon--w2" />
                Email xác nhận đã gửi tới {otp?.email ?? form.email}
              </p>
              <button type="button" className="btn btn--primary apply-success__btn" onClick={onClose}>
                Xem việc làm khác
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldError({ id, text, center }: { id: string; text: string; center?: boolean }) {
  return (
    <span className={cx('apply-field__error', center && 'apply-field__error--center')} id={id} role="alert">
      {text}
    </span>
  );
}
