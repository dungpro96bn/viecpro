'use client';

import ApplyButton from '@/components/apply/ApplyButton';
import { useBeforeFooter } from '@/components/layout/useBeforeFooter';
import { cx } from '@/lib/format';
import type { ApplyJob } from '@/lib/types';

/**
 * Thanh ứng tuyển dính đáy màn hình (tablet / mobile).
 * Luôn hiện trong lúc xem đơn, chỉ ẩn khi cuộn tới footer.
 */
export default function StickyApplyBar({ job, salary }: { job: ApplyJob; salary: string }) {
  const show = useBeforeFooter();

  return (
    <div className={cx('apply-bar', show && 'apply-bar--show')} inert={!show}>
      <div className="container apply-bar__inner">
        <span className="apply-bar__info">
          <span className="apply-bar__label">Lương cơ bản</span>
          <span className="apply-bar__salary">
            {salary}
            <span className="apply-bar__per">/tháng</span>
          </span>
        </span>
        <ApplyButton job={job} className="btn btn--primary apply-bar__apply">
          Ứng tuyển ngay
        </ApplyButton>
      </div>
    </div>
  );
}
