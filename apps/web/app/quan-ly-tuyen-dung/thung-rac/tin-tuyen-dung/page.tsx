import type { Metadata } from 'next';
import TrashJobs from './TrashJobs';

export const metadata: Metadata = {
  title: 'Tin tuyển dụng đã xoá',
};

export default function TrashJobsPage() {
  return <TrashJobs />;
}
