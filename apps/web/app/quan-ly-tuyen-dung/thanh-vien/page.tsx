import type { Metadata } from 'next';
import MembersManager from './MembersManager';

export const metadata: Metadata = {
  title: 'Thành viên',
};

export default function EmployerMembersPage() {
  return <MembersManager />;
}
