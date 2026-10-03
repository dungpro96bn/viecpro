'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { confirmTextMatches } from '@viecpro/shared';
import { IconTrash, IconWarning } from './Icons';
import './confirm-dialog.css';

interface Props {
  open: boolean;
  title: string;
  /** Hậu quả của thao tác – hiện thành danh sách */
  consequences: ReactNode[];
  /** Chuỗi người dùng phải gõ lại đúng (vd. tên thành viên); phải khớp đúng 100% – API kiểm tra lại bằng confirmTextMatches */
  confirmText: string;
  actionLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: (typed: string) => void;
  onClose: () => void;
}

/**
 * Hộp thoại xác nhận thao tác không hoàn tác được (xoá vĩnh viễn từ Thùng rác):
 * nút chỉ bật khi gõ lại đúng tên đối tượng. Dùng <dialog> gốc – bẫy focus, phím Esc có sẵn.
 */
export default function ConfirmTypeDialog({ open, title, consequences, confirmText, actionLabel, busy, error, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const inputId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setTyped('');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const matches = confirmTextMatches(typed, confirmText);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches && !busy) onConfirm(typed);
  };

  return (
    <dialog ref={ref} className="ctd" onClose={onClose} onCancel={onClose} aria-labelledby={`${inputId}-title`}>
      <form className="ctd__body" onSubmit={submit}>
        <span className="ctd__icon">
          <IconWarning size={22} />
        </span>
        <h2 className="ctd__title" id={`${inputId}-title`}>
          {title}
        </h2>
        <ul className="ctd__list">
          {consequences.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <label className="ctd__field" htmlFor={inputId}>
          Gõ <b className="ctd__key">{confirmText}</b> để xác nhận
        </label>
        <input
          id={inputId}
          className="ctd__input"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          maxLength={200}
          onChange={(e) => setTyped(e.target.value)}
          aria-invalid={typed.length > 0 && !matches}
          autoFocus
        />
        {error && (
          <p className="ctd__error" role="alert">
            {error}
          </p>
        )}
        <div className="ctd__actions">
          <button type="button" className="emp-btn" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button type="submit" className="emp-btn ctd__danger" disabled={!matches || busy}>
            <IconTrash size={15} />
            {busy ? 'Đang xoá…' : actionLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
