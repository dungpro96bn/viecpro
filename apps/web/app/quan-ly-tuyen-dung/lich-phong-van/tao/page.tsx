import type { Metadata } from 'next';
import CreateInterviewForm from './CreateInterviewForm';
import './create-interview.css';

export const metadata: Metadata = {
  title: 'Tạo lịch hẹn',
};

export default function EmployerCreateInterviewPage() {
  return <CreateInterviewForm />;
}
