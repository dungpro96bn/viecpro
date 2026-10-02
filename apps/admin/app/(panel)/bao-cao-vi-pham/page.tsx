import type { Metadata } from 'next';
import ReportsView from './ReportsView';
import '@/components/list/list.css';
import './reports.css';

export const metadata: Metadata = { title: 'Báo cáo vi phạm' };

export default function ReportsPage() {
  return <ReportsView />;
}
