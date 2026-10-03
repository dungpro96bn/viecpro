import type { Metadata } from 'next';
import LeadsView from './LeadsView';
import './leads.css';

export const metadata: Metadata = { title: 'Khách cần tư vấn' };

export default function EmployerLeadsPage() {
  return <LeadsView />;
}
