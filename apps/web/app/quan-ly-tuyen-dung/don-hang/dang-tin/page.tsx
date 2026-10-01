import type { Metadata } from 'next';
import JobPostForm from '@/components/employer/JobPostForm';

export const metadata: Metadata = {
  title: 'Đăng tin mới',
};

export default function EmployerNewJobPage() {
  return <JobPostForm />;
}
