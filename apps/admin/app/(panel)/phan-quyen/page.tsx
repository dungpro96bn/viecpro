import type { Metadata } from 'next';
import PermissionsView from './PermissionsView';
import '@/components/list/list.css';
import '@/components/ui/ui.css';
import './permissions.css';

export const metadata: Metadata = { title: 'Phân quyền' };

export default function PermissionsPage() {
  return <PermissionsView />;
}
