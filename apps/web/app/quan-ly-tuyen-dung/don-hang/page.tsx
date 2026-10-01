import type { Metadata } from 'next';
import JobsManager from './JobsManager';
import './jobs.css';

export const metadata: Metadata = {
  title: 'Tin tuyển dụng',
};

export default function EmployerJobsPage() {
  return <JobsManager />;
}
