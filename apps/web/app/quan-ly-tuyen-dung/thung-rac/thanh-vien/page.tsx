import type { Metadata } from 'next';
import TrashMembers from './TrashMembers';

export const metadata: Metadata = {
  title: 'Thành viên đã xoá',
};

export default function TrashMembersPage() {
  return <TrashMembers />;
}
