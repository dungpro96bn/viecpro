import type { Metadata } from 'next';
import InterviewCalendar from './InterviewCalendar';
import './calendar.css';

export const metadata: Metadata = {
  title: 'Lịch phỏng vấn',
};

export default function EmployerInterviewsPage() {
  return <InterviewCalendar />;
}
