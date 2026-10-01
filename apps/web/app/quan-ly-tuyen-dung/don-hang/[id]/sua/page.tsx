import type { Metadata } from 'next';
import JobPostForm from '@/components/employer/JobPostForm';

export const metadata: Metadata = {
  title: 'Sửa tin tuyển dụng',
};

export default async function EmployerEditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobPostForm jobId={id} />;
}
