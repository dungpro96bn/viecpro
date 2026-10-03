import type { Metadata } from 'next';
import ReportsView from './ReportsView';
import './reports.css';

export const metadata: Metadata = { title: 'Báo cáo thống kê' };

export default function EmployerReportsPage() {
  return <ReportsView />;
}
