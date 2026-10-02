'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { JOB_REJECT_REASONS } from '@viecpro/shared';
import { cx } from '@/lib/format';

export type Decision = 'reject' | 'request-changes';

const COPY: Record<Decision, { title: string; desc: string; confirm: string; placeholder: string }> = {
  reject: {
    title: 'Từ chối tin tuyển dụng',
    desc: 'Tin sẽ không được hiển thị. Lý do được gửi cho nhà tuyển dụng.',
    confirm: 'Từ chối tin',
    placeholder: 'Ghi chú thêm cho nhà tuyển dụng (không bắt buộc nếu đã chọn lý do)',
  },
  'request-changes': {
    title: 'Yêu cầu nhà tuyển dụng sửa tin',
    desc: 'Nhà tuyển dụng sửa theo yêu cầu rồi gửi lại – tin quay về hàng chờ duyệt.',
    confirm: 'Gửi yêu cầu sửa',
    placeholder: 'Nêu rõ nội dung cần sửa, vd. bổ sung bảng chi phí xuất cảnh…',
  },
};

interface Props {
  open: Decision | null;
  jobTitle: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Hộp thoại từ chối / yêu cầu sửa: chọn lý do mẫu (spec 12.1) + ghi chú */
export default function DecisionDialog({ open, jobTitle, busy, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setPicked([]);
      setNote('');
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const reason = [picked.join('; '), note.trim()].filter(Boolean).join('. ');
  const copy = open ? COPY[open] : COPY.reject;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (reason.length >= 5) onConfirm(reason.slice(0, 500));
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <form className="dialog__body" onSubmit={submit}>
        <h2 className="dialog__title">{copy.title}</h2>
        <p className="dialog__desc">
          {copy.desc} Tin: “{jobTitle}”.
        </p>
        <div className="mod-reasons" role="group" aria-label="Lý do mẫu">
          {JOB_REJECT_REASONS.map((r) => {
            const on = picked.includes(r);
            return (
              <button key={r} type="button" aria-pressed={on} className={cx('chip-toggle', on && 'chip-toggle--on')} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== r) : [...p, r]))}>
                {r}
              </button>
            );
          })}
        </div>
        <label className="field">
          <span className="field__label">Ghi chú</span>
          <textarea className="field__input field__input--area" value={note} maxLength={400} placeholder={copy.placeholder} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="dialog__actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button type="submit" className={cx('btn', open === 'reject' ? 'btn--danger-solid' : 'btn--warning-solid')} disabled={busy || reason.length < 5}>
            {busy ? <span className="spinner" /> : copy.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
