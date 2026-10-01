'use client';

import { useBeforeFooter } from '../layout/useBeforeFooter';
import { IconChat, IconPhone } from '../ui/Icons';
import { cx } from '@/lib/format';

interface ProfileActionBarProps {
  /** Liên kết nút gọi (tel:… hoặc #lien-he khi số điện thoại bị ẩn) */
  callHref: string;
  callLabel?: string;
  ctaLabel: string;
}

/** Thanh liên hệ dính đáy trang hồ sơ (tablet / mobile), ẩn khi cuộn tới footer */
export default function ProfileActionBar({ callHref, callLabel = 'Gọi ngay', ctaLabel }: ProfileActionBarProps) {
  const show = useBeforeFooter();

  return (
    <div className={cx('profile-bar', show && 'profile-bar--show')} inert={!show}>
      <div className="container profile-bar__inner">
        <a href={callHref} className="btn btn--outline profile-bar__btn">
          <IconPhone size={17} />
          {callLabel}
        </a>
        <a href="#tu-van" className="btn btn--primary profile-bar__btn profile-bar__cta">
          <IconChat size={17} className="icon--w2" />
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
