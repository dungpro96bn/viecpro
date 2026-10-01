import type { Metadata } from 'next';
import ApplicantsManager from './ApplicantsManager';
import './applicants.css';

export const metadata: Metadata = {
  title: 'Ứng viên',
};

export default function EmployerApplicantsPage() {
  return <ApplicantsManager />;
}
