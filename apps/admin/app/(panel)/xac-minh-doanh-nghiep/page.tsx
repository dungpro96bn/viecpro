import type { Metadata } from 'next';
import VerificationsView from './VerificationsView';
import '@/components/list/list.css';
import './verifications.css';

export const metadata: Metadata = { title: 'Xác minh doanh nghiệp' };

export default function VerificationsPage() {
  return <VerificationsView />;
}
