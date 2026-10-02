import type { Metadata } from 'next';
import AuditLogView from './AuditLogView';
import '@/components/list/list.css';
import './audit.css';

export const metadata: Metadata = { title: 'Nhật ký hệ thống' };

export default function AuditLogPage() {
  return <AuditLogView />;
}
