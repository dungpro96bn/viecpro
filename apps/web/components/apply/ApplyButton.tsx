'use client';

import type { ReactNode } from 'react';
import type { ApplyJob } from '@/lib/types';
import { useApply } from './ApplyProvider';

interface ApplyButtonProps {
  job: ApplyJob;
  className?: string;
  children?: ReactNode;
}

/** Nút mở popup "Ứng tuyển nhanh" cho một đơn hàng */
export default function ApplyButton({ job, className = 'btn btn--primary btn--md btn--shadow', children = 'Ứng tuyển ngay' }: ApplyButtonProps) {
  const { openApply } = useApply();
  if (job.closed) {
    return (
      <button type="button" className={className} disabled>
        Đã ngừng tuyển
      </button>
    );
  }
  return (
    <button type="button" className={className} aria-haspopup="dialog" onClick={() => openApply(job)}>
      {children}
    </button>
  );
}
