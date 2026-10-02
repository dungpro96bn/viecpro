import type { Metadata } from 'next';
import EmployersView from './EmployersView';
import '@/components/list/list.css';
import './employers.css';

export const metadata: Metadata = { title: 'Nhà tuyển dụng' };

export default function EmployersPage() {
  return <EmployersView />;
}
