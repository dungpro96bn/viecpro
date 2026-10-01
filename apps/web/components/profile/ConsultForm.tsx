'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { IconCheck } from '../ui/Icons';
import { apiRequest, apiMessage } from '@/lib/api';
import './profile.css';

interface ConsultFormProps {
  title: string;
  description: string;
  successTitle: string;
  successText: string;
  /** Các ô chọn bổ sung (select) nằm giữa số điện thoại và nút gửi */
  extraFields?: ReactNode;
  employerSlug?: string;
  recruiterSlug?: string;
  jobId?: string;
}

/** Khối "Đăng ký tư vấn" nền xanh ở sidebar trang hồ sơ */
export default function ConsultForm({ title, description, successTitle, successText, extraFields, employerSlug, recruiterSlug, jobId }: ConsultFormProps) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest<void>('/leads/consultations', { method: 'POST', body: JSON.stringify({ name: data.get('name'), phone: data.get('phone'), employerSlug, recruiterSlug, jobId }) });
      setSent(true);
    } catch (cause) {
      setError(apiMessage(cause, 'Không gửi được yêu cầu. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="tu-van" className="consult-box">
      <span className="consult-box__bubble" />
      {!sent ? (
        <form
          className="consult-box__form"
          onSubmit={(event) => void submit(event)}
        >
          <span className="consult-box__title">{title}</span>
          <span className="consult-box__desc">{description}</span>
          <input className="field-input field-input--bare" type="text" name="name" aria-label="Họ và tên" placeholder="Họ và tên" required />
          <input className="field-input field-input--bare" type="tel" name="phone" aria-label="Số điện thoại / Zalo" placeholder="Số điện thoại / Zalo" required />
          {extraFields}
          {error && <span className="consult-box__desc" role="alert">{error}</span>}
          <button type="submit" className="btn btn--white consult-box__submit" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi yêu cầu tư vấn'}
          </button>
        </form>
      ) : (
        <div className="consult-box__done">
          <span className="consult-box__done-icon">
            <IconCheck size={28} className="icon--w26" />
          </span>
          <span className="consult-box__done-title">{successTitle}</span>
          <span className="consult-box__desc">{successText}</span>
          <button type="button" className="consult-box__again" onClick={() => setSent(false)}>
            Gửi yêu cầu khác
          </button>
        </div>
      )}
    </div>
  );
}
