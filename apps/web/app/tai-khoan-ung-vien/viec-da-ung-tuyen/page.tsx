import type { Metadata } from 'next';
import AppliedJobs from './AppliedJobs';
import './applied.css';

export const metadata: Metadata = {
  title: 'Việc đã ứng tuyển',
};

export default function SeekerApplicationsPage() {
  return <AppliedJobs />;
}
