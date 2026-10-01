import type { Metadata } from 'next';
import SavedJobs from './SavedJobs';
import './saved.css';

export const metadata: Metadata = {
  title: 'Việc đã lưu',
};

export default function SeekerSavedJobsPage() {
  return <SavedJobs />;
}
