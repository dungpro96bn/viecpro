'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/lib/format';
import { IconCheck, IconShare } from './Icons';

/** Chia sẻ trang: dùng bảng chia sẻ của hệ điều hành (mobile), không có thì sao chép liên kết */
export default function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return; // người dùng tự đóng bảng chia sẻ
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Sao chép liên kết đơn hàng:', url);
    }
  };

  return (
    <button type="button" className={cx('share-btn', className, copied && 'share-btn--copied')} aria-label="Chia sẻ đơn hàng" onClick={share}>
      {copied ? <IconCheck size={19} className="icon--w24" /> : <IconShare size={19} />}
      <span className="share-btn__toast" role="status">
        {copied ? 'Đã sao chép liên kết' : ''}
      </span>
    </button>
  );
}
