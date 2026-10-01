import type { Metadata } from 'next';
import DashboardView from './_dashboard/DashboardView';
import './_dashboard/dashboard.css';

export const metadata: Metadata = {
  title: 'Bảng điều khiển',
};

export default function DashboardPage() {
  return <DashboardView />;
}
