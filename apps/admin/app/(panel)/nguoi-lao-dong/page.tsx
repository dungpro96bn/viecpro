import type { Metadata } from 'next';
import SeekersView from './SeekersView';
import '@/components/list/list.css';
import './seekers.css';

export const metadata: Metadata = { title: 'Danh sách ứng viên' };

export default function SeekersPage() {
  return <SeekersView />;
}
