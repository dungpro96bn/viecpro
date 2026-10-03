'use client';

import { Children, Fragment, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { IconCheck } from '@/components/ui/Icons';
import Select from '@/components/ui/Select';
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
  const labelId = useId();
  const resolvedErrorId = errorId ?? `${labelId}-error`;
  const labeledChildren = labelControl(children, labelId, error ? resolvedErrorId : undefined, !!error);

  return (
    <div className={cx('ef-field', className)}>
      <span className="ef-field__head">
        <span className="ef-field__label" id={labelId}>
          {label}
          {required && <span className="ef-field__req" aria-hidden="true">*</span>}
        </span>
        {extra && <span className="ef-field__extra">{extra}</span>}
      </span>
      {labeledChildren}
      {hint && !error && <span className="ef-field__hint">{hint}</span>}
      {error && (
        <span className="ef-field__error" id={resolvedErrorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Ghép danh sách id cho aria-describedby, bỏ trùng (input có thể đã tự trỏ tới errorId) */
function joinIds(...ids: Array<string | undefined>): string | undefined {
  return [...new Set(ids.flatMap((id) => id?.split(' ') ?? []).filter(Boolean))].join(' ') || undefined;
}

/** Gắn nhãn chung vào input nằm trực tiếp hoặc trong wrapper của Field. */
function labelControl(child: ReactNode, labelId: string, errorId: string | undefined, invalid: boolean): ReactNode {
  return Children.map(child, (node) => {
    if (!isValidElement(node)) return node;
    if (node.type === Select) {
      const props = node.props as { 'aria-describedby'?: string };
      const describedBy = joinIds(props['aria-describedby'], errorId);
      return cloneElement(node as ReactElement<{ 'aria-labelledby'?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>, {
        'aria-labelledby': labelId,
        'aria-describedby': describedBy,
        ...(invalid ? { 'aria-invalid': true } : {}),
      });
    }
    if (node.type === Fragment) {
      const props = node.props as { children?: ReactNode };
      return cloneElement(node as ReactElement<{ children?: ReactNode }>, {}, labelControl(props.children, labelId, errorId, invalid));
    }
    if (typeof node.type !== 'string') return node;

    const props = node.props as {
      children?: ReactNode;
      'aria-label'?: string;
      'aria-labelledby'?: string;
      'aria-describedby'?: string;
      'aria-invalid'?: boolean;
    };
    // Checkbox / radio đã có nhãn riêng (label bao quanh) – không đè bằng nhãn của Field
    const inputType = (node.props as { type?: string }).type;
    const isTextControl = node.type === 'textarea' || node.type === 'select' || (node.type === 'input' && inputType !== 'checkbox' && inputType !== 'radio' && inputType !== 'hidden');
    if (isTextControl) {
      return cloneElement(node as ReactElement<Record<string, unknown>>, {
        ...(!props['aria-label'] && !props['aria-labelledby'] ? { 'aria-labelledby': labelId } : {}),
        ...(errorId ? { 'aria-describedby': joinIds(props['aria-describedby'], errorId) } : {}),
        ...(invalid && props['aria-invalid'] === undefined ? { 'aria-invalid': true } : {}),
      });
    }
    if (props.children !== undefined) {
      return cloneElement(node as ReactElement<{ children?: ReactNode }>, {}, labelControl(props.children, labelId, errorId, invalid));
    }
    return node;
  });
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
