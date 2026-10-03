import type { Metadata } from 'next';
import PartnerJobsView from './PartnerJobsView';

export const metadata: Metadata = { title: 'Tin đối tác' };

export default function PartnerJobsPage() {
  return <PartnerJobsView />;
}
