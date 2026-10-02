'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconCopy } from '@/components/ui/Icons';

/** Mật khẩu tạm chỉ hiện 1 lần – đóng hộp thoại là không xem lại được */
export default function TempPasswordDialog({ value, onClose }: { value: { name: string; email: string; password: string } | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (value && !d.open) {
      setCopied(false);
      d.showModal();
    }
    if (!value && d.open) d.close();
  }, [value]);

  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value.password).catch(() => undefined);
    setCopied(true);
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <div className="dialog__body">
        <h2 className="dialog__title">Mật khẩu tạm của {value?.name}</h2>
        <p className="dialog__desc">
          Gửi mật khẩu này cho <b>{value?.email}</b> qua kênh an toàn. Mật khẩu <b>chỉ hiện 1 lần</b>. Lần đăng nhập đầu tiên người nhận phải bật xác thực 2 bước.
        </p>
        <div className="pq-secret">
          <code>{value?.password}</code>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => void copy()}>
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            {copied ? 'Đã chép' : 'Chép'}
          </button>
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Tôi đã lưu mật khẩu
          </button>
        </div>
      </div>
    </dialog>
  );
}
