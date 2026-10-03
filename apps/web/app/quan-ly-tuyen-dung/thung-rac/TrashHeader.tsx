import Link from 'next/link';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';

/** Đầu trang chung cho mọi mục trong Thùng rác */
export default function TrashHeader({ current }: { current?: string }) {
  return (
    <div className="emp-page-head">
      <span className="emp-page-head__titles">
        <nav className="emp-crumbs" aria-label="Breadcrumb">
          <Link href={EMPLOYER_BASE}>Tổng quan</Link>
          <span className="emp-crumbs__sep">/</span>
          {current ? (
            <>
              <Link href={`${EMPLOYER_BASE}/thung-rac`}>Thùng rác</Link>
              <span className="emp-crumbs__sep">/</span>
              <span className="emp-crumbs__current">{current}</span>
            </>
          ) : (
            <span className="emp-crumbs__current">Thùng rác</span>
          )}
        </nav>
        <h1 className="emp-page-head__title">{current ?? 'Thùng rác'}</h1>
      </span>
    </div>
  );
}
