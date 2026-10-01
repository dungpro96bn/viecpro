import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SearchView from './SearchView';
import './search.css';

export const metadata: Metadata = {
  title: 'Tìm việc làm Nhật Bản',
};

export default function SearchPage() {
  return (
    <div className="page page--fluid">
      <Header active="jobs" />
      <SearchView
        breadcrumb={
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Trang chủ</Link>
            <span className="breadcrumb__sep">/</span>
            <span className="breadcrumb__current">Tìm việc làm Nhật Bản</span>
          </nav>
        }
      />
      <Footer />
    </div>
  );
}
