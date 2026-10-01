import type { Metadata } from 'next';
import CandidateDashboard from './CandidateDashboard';
import './account.css';

export const metadata: Metadata = {
  title: 'Tổng quan tài khoản',
  description: 'Quản lý hồ sơ, theo dõi đơn ứng tuyển và tìm việc phù hợp trên viecpro.',
};

export default function CandidateAccountPage() {
  return <CandidateDashboard />;
}
