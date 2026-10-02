'use client';

import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { IconChevronDown } from '@/components/ui/Icons';
import { cx } from '@/lib/format';

interface Props {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  tone: 'blue' | 'orange' | 'green' | 'teal' | 'red';
  title: string;
  desc: string;
  children?: ReactNode;
  /** Phần ẩn sau nút "Xem thêm" (nguyên tắc "ít chữ, nhiều ý") */
  more?: ReactNode;
  moreLabel: string;
}

/** Thẻ cài đặt: đầu thẻ có icon, các dòng chính, phần "Xem thêm" mở rộng được */
export default function SettingsCard({ id, icon: Icon, tone, title, desc, children, more, moreLabel }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = `${id}-more`;
  return (
    <section className="st-card" id={id} aria-labelledby={`${id}-title`}>
      <div className="st-card__head">
        <span className={cx('st-card__icon', `st-card__icon--${tone}`)}>
          <Icon size={20} />
        </span>
        <span className="st-card__titles">
          <b id={`${id}-title`}>{title}</b>
          <span>{desc}</span>
        </span>
      </div>
      {children && <div className="st-card__rows">{children}</div>}
      {more && open && (
        <div className="st-card__rows st-card__rows--more" id={panelId}>
          {more}
        </div>
      )}
      {more && (
        <button type="button" className={cx('st-card__more', open && 'st-card__more--open')} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          {open ? 'Thu gọn' : moreLabel}
          <IconChevronDown size={15} />
        </button>
      )}
    </section>
  );
}

/** Một dòng cài đặt: tên + mô tả bên trái, điều khiển bên phải; `children` (form) hiện bên dưới */
export function SettingRow({ label, desc, control, children }: { label: string; desc?: ReactNode; control?: ReactNode; children?: ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row__main">
        <span className="st-row__text">
          <span className="st-row__label">{label}</span>
          {desc && <span className="st-row__desc">{desc}</span>}
        </span>
        {control}
      </div>
      {children}
    </div>
  );
}

/** Nhóm nút chọn 1 (ngôn ngữ, giao diện, hiển thị số điện thoại) */
export function Segment<T extends string>({ value, options, onChange, label }: { value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <span className="st-segment" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={cx('st-segment__item', value === o.value && 'st-segment__item--on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}
