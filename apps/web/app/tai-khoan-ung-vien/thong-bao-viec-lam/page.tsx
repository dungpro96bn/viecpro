import type { Metadata } from 'next';
import JobAlerts from './JobAlerts';
import './alerts.css';

export const metadata: Metadata = {
  title: 'Thông báo việc làm',
};

export default function SeekerJobAlertsPage() {
  return <JobAlerts />;
}
