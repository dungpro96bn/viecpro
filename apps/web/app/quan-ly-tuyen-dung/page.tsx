import type { Metadata } from 'next';
import EmployerDashboard from './EmployerDashboard';
import './dashboard.css';

export const metadata: Metadata = {
  title: 'Tổng quan',
};

export default function EmployerHomePage() {
  return <EmployerDashboard />;
}
