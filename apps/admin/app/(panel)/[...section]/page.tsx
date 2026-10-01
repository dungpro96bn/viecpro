import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NAV } from '@/lib/nav';
import './placeholder.css';

type Params = { section: string[] };

const findItem = (section: string[]) => NAV.flatMap((g) => g.items).find((i) => i.href === `/${section.join('/')}`);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { title: findItem((await params).section)?.label ?? 'Không tìm thấy' };
}

/** Màn hình trong menu nhưng chưa làm – hiện thông báo thay vì trang lỗi */
export default async function SectionPlaceholder({ params }: { params: Promise<Params> }) {
  const item = findItem((await params).section);
  if (!item) notFound();
  const Icon = item.icon;

  return (
    <>
      <header className="page-header">
        <span className="page-header__titles">
          <span className="page-header__meta">Quản trị viecpro</span>
          <h1 className="page-header__title">{item.label}</h1>
        </span>
      </header>
      <div className="page-body">
        <div className="panel placeholder">
          <span className="placeholder__icon">
            <Icon size={26} />
          </span>
          <h2 className="placeholder__title">Màn hình đang được xây dựng</h2>
          <p className="placeholder__desc">
            Mục <b>{item.label}</b> sẽ có trong đợt tiếp theo. Các thao tác nhanh đã có sẵn trên bảng điều khiển.
          </p>
          <Link href="/" className="btn btn--dark">
            Về bảng điều khiển
          </Link>
        </div>
      </div>
    </>
  );
}
