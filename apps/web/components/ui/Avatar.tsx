import { cx } from '@/lib/format';
import { IconCheck, IconPersonSilhouette } from './Icons';
import './ui.css';

interface AvatarProps {
  src?: string;
  alt?: string;
  /** Kích thước (px) – chỉ nhận các cỡ có sẵn trong ui.css */
  size?: 26 | 32 | 44 | 56 | 68;
  /** Hiện dấu tích xanh "đã xác thực" ở góc */
  verified?: boolean;
  className?: string;
}

export default function Avatar({ src, alt = '', size = 44, verified = false, className }: AvatarProps) {
  return (
    <span className={cx('avatar', `avatar--${size}`, className)}>
      {src ? (
        <img className="avatar__img" src={src} alt={alt} loading="lazy" />
      ) : (
        <span className="avatar__placeholder" aria-hidden="true">
          <IconPersonSilhouette size={Math.round(size * 0.77)} />
        </span>
      )}
      {verified && (
        <span className="avatar__verified" aria-label="Đã xác thực">
          <IconCheck size={9} className="icon--w4" />
        </span>
      )}
    </span>
  );
}
