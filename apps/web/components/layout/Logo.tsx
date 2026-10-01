import Link from 'next/link';
import { cx } from '@/lib/format';
import { IconCheckMark } from '../ui/Icons';
import './layout.css';

const MARK_SIZE = { light: 20, dark: 18, brand: 22 };

/** Logo viecpro. tone="dark" dùng trên nền tối (footer), tone="brand" dùng trên nền xanh (trang đăng nhập / đăng ký) */
export default function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' | 'brand' }) {
  return (
    <Link href="/" aria-label="viecpro – Trang chủ" className={cx('logo', tone !== 'light' && `logo--${tone}`)}>
      <span className="logo__mark">
        <IconCheckMark size={MARK_SIZE[tone]} className="icon--w26" />
      </span>
      <span className="logo__text">
        Viec<span className="logo__accent">Pro</span>
      </span>
    </Link>
  );
}
