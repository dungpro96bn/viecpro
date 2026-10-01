import type { Metadata } from 'next';
import AddApplicantForm from './AddApplicantForm';
import './add-applicant.css';

export const metadata: Metadata = {
  title: 'Thêm ứng viên',
};

export default function EmployerAddApplicantPage() {
  return <AddApplicantForm />;
}
