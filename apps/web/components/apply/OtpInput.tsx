'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cx } from '@/lib/format';

const LENGTH = 6;

/**
 * 6 ô nhập mã OTP: tự chuyển ô, Backspace lùi ô, dán cả mã một lần,
 * `autocomplete="one-time-code"` để điện thoại gợi ý mã. Đủ 6 số thì gọi onComplete.
 */
export default function OtpInput({ value, onChange, onComplete, invalid, describedBy }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; invalid?: boolean; describedBy?: string }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    refs.current[Math.min(clean.length, LENGTH - 1)]?.focus();
  };

  const onInput = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    // Gõ nhiều số cùng lúc (tự điền của điện thoại) → điền từ ô hiện tại
    commit((value.slice(0, i) + digits).slice(0, LENGTH));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const at = value[i] ? i : i - 1;
      if (at < 0) return;
      onChange(value.slice(0, at));
      refs.current[at]?.focus();
    } else if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    commit(e.clipboardData.getData('text'));
  };

  return (
    <div className="otp-input" role="group" aria-label="Mã xác nhận 6 số">
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={cx('otp-input__cell', value[i] && 'otp-input__cell--filled', invalid && 'otp-input__cell--invalid')}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={i === 0 ? LENGTH : 1}
          value={value[i] ?? ''}
          aria-label={`Số thứ ${i + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
