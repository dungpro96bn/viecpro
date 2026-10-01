import { avatarTone, initialOf } from '@/lib/employer';
import { cx } from '@/lib/format';

/** Avatar chữ cái của ứng viên – màu ổn định theo tên */
export default function ApplicantAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx('emp-avatar', `emp-avatar--${avatarTone(name)}`, size !== 'md' && `emp-avatar--${size}`)} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}
