'use client';

import type { ReactNode } from 'react';
import { IconCheck } from '@/components/ui/Icons';
import { cx } from '@/lib/format';
import './form.css';

/** Khối mục đánh số của form (khu NTD: đăng tin, thêm ứng viên, tạo lịch hẹn; hồ sơ ứng viên) */
export function FormSection({ num, title, desc, id, aside, children }: { num: number; title: string; desc?: string; id?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="ef-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="ef-section__head">
        <span className="ef-section__titles">
          <span className="ef-section__num">{num}</span>
          <span>
            <b className="ef-section__title" id={id ? `${id}-title` : undefined}>
              {title}
            </b>
            {desc && <span className="ef-section__desc">{desc}</span>}
          </span>
        </span>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Ô nhập có nhãn, dấu * bắt buộc, chú thích / bộ đếm bên phải và lỗi bên dưới */
export function Field({
  label,
  required,
  extra,
  hint,
  error,
  errorId,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  extra?: ReactNode;
  hint?: ReactNode;
  error?: string;
  errorId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('ef-field', className)}>
      <span className="ef-field__head">
        <span className="ef-field__label">
          {label}
          {required && <span className="ef-field__req">*</span>}
        </span>
        {extra && <span className="ef-field__extra">{extra}</span>}
      </span>
      {children}
      {hint && !error && <span className="ef-field__hint">{hint}</span>}
      {error && (
        <span className="ef-field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Nhóm nút chọn 1 trong n (radio) hoặc nhiều (toggle) dạng chip */
export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  invalid,
  size = 'md',
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T | '';
  onChange: (v: T) => void;
  label: string;
  invalid?: boolean;
  size?: 'md' | 'sm';
}) {
  return (
    <div className="ef-options" role="radiogroup" aria-label={label} aria-invalid={invalid || undefined}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={cx('ef-option', size === 'sm' && 'ef-option--sm', value === o.value && 'ef-option--on', invalid && 'ef-option--invalid')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ô tích dạng thẻ (phúc lợi, kênh nhận hồ sơ, kỹ năng) */
export function CheckCard({ checked, onChange, children, className }: { checked: boolean; onChange: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} className={cx('ef-check', checked && 'ef-check--on', className)} onClick={onChange}>
      <span className="ef-check__box" aria-hidden="true">
        <IconCheck size={11} className="icon--w4" />
      </span>
      {children}
    </button>
  );
}

/** Thêm / bỏ một giá trị khỏi mảng (dùng cho nhóm chọn nhiều) */
export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
