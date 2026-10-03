import type { Metadata } from 'next';
import ExportView from './ExportView';
import '../admin-tools.css';

export const metadata: Metadata = { title: 'Xuất dữ liệu' };

export default function ExportPage() {
  return <ExportView />;
}
