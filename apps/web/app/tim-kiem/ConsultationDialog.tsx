'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { consultSchema } from '@viecpro/shared';
import { apiMessage, apiRequest } from '@/lib/api';
import { IconCheck, IconClose } from '@/components/ui/Icons';

type Field = 'name' | 'phone';

export default function ConsultationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  useEffect(() => {
    if (open && !dialogRef.current?.open) {
      setSent(false);
      setBusy(false);
      setError('');
      setFieldErrors({});
      dialogRef.current?.showModal();
    } else if (!open && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = consultSchema.safeParse({ name: data.get('name'), phone: data.get('phone') });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'name' || field === 'phone') && !next[field]) next[field] = issue.message;
      }
      setFieldErrors(next);
      form.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0] ?? 'name'}"]`)?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await apiRequest<void>('/leads/consultations', { method: 'POST', body: JSON.stringify(parsed.data) });
      setSent(true);
    } catch (cause) {
      setError(apiMessage(cause, 'Không gửi được yêu cầu. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const clearFieldError = (field: Field) => setFieldErrors((current) => ({ ...current, [field]: undefined }));

  return (
    <dialog ref={dialogRef} className="consult-dialog" aria-labelledby="consult-dialog-title" onClose={onClose}>
      <div className="consult-dialog__panel">
        <button type="button" className="consult-dialog__close" aria-label="Đóng" onClick={() => dialogRef.current?.close()}>
          <IconClose size={18} />
        </button>
        {!sent ? (
          <form className="consult-dialog__form" noValidate onSubmit={(event) => void submit(event)}>
            <span className="consult-dialog__eyebrow">Tư vấn miễn phí</span>
            <h2 id="consult-dialog-title" className="consult-dialog__title">Để lại thông tin, chúng tôi sẽ gọi tư vấn</h2>
            <p className="consult-dialog__desc">Cán bộ sẽ liên hệ để gợi ý đơn phù hợp với mong muốn của bạn.</p>
            <label className="consult-dialog__field">
              <span>Họ và tên <span className="consult-dialog__req">*</span></span>
              <input className={`field-input${fieldErrors.name ? ' consult-dialog__input--invalid' : ''}`} name="name" type="text" autoComplete="name" maxLength={80} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'consult-name-error' : undefined} onChange={() => clearFieldError('name')} />
              {fieldErrors.name && <span className="consult-dialog__field-error" id="consult-name-error">{fieldErrors.name}</span>}
            </label>
            <label className="consult-dialog__field">
              <span>Số điện thoại <span className="consult-dialog__req">*</span></span>
              <input className={`field-input${fieldErrors.phone ? ' consult-dialog__input--invalid' : ''}`} name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? 'consult-phone-error' : undefined} onChange={() => clearFieldError('phone')} />
              {fieldErrors.phone && <span className="consult-dialog__field-error" id="consult-phone-error">{fieldErrors.phone}</span>}
            </label>
            {error && <p className="consult-dialog__error" role="alert">{error}</p>}
            <button type="submit" className="btn btn--primary consult-dialog__submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Nhờ tư vấn miễn phí'}</button>
          </form>
        ) : (
          <div className="consult-dialog__success" role="status">
            <span className="consult-dialog__success-icon"><IconCheck size={24} /></span>
            <h2 id="consult-dialog-title" className="consult-dialog__title">Đã nhận yêu cầu tư vấn</h2>
            <p className="consult-dialog__desc">Cảm ơn bạn. Cán bộ tư vấn sẽ sớm liên hệ qua số điện thoại đã cung cấp.</p>
            <button type="button" className="btn btn--primary consult-dialog__submit" onClick={() => dialogRef.current?.close()}>Đóng</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
