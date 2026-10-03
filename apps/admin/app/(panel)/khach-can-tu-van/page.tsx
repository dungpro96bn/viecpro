import type { Metadata } from 'next';
import LeadsView from './LeadsView';
import '@/components/list/list.css';
import './leads.css';

export const metadata: Metadata = { title: 'Khách cần tư vấn' };

export default function LeadsPage() {
  return <LeadsView />;
}
