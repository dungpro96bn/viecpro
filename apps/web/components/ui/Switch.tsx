'use client';

import { cx } from '@/lib/format';
import './switch.css';

interface SwitchProps {
  on: boolean;
  onChange: (on: boolean) => void;
  /** Bắt buộc – nút không có chữ nên cần nhãn cho trình đọc màn hình */
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/** Công tắc bật / tắt (role="switch") – dùng cho cài đặt thông báo, bật tắt thông báo việc làm */
export default function Switch({ on, onChange, label, disabled, size = 'sm' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={cx('ui-switch', size === 'md' && 'ui-switch--md', on && 'ui-switch--on')}
      onClick={() => onChange(!on)}
    >
      <span className="ui-switch__knob" />
    </button>
  );
}
