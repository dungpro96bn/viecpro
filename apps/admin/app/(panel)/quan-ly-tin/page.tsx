import type { Metadata } from 'next';
import JobsManageView from './JobsManageView';
import '../admin-tools.css';

export const metadata: Metadata = { title: 'Sửa tin thay nhà tuyển dụng' };

export default function ManageJobsPage() {
  return <JobsManageView />;
}
