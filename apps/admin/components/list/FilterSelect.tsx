'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { IconCheck, IconChevronDown } from '@/components/ui/Icons';
import { cx } from '@/lib/format';

interface Props<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** Ô lọc dạng "Ngành nghề: Tất cả ▾" – menu chọn 1 theo mẫu ARIA listbox */
export default function FilterSelect<T extends string>({ label, value, options, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span className="filter-select" ref={ref}>
      <button type="button" className={cx('filter-select__button', value !== options[0]?.value && 'filter-select__button--set')} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        <span className="filter-select__label">{label}:</span>
        <b>{current?.label}</b>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <ul className="filter-select__menu" role="listbox" id={listId} aria-label={label}>
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={cx('filter-select__option', o.value === value && 'filter-select__option--on')}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
                {o.value === value && <IconCheck size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
