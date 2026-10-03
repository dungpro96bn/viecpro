import type { Metadata } from 'next';
import SettingsView from './SettingsView';
import '../admin-tools.css';

export const metadata: Metadata = { title: 'Cài đặt hệ thống' };

export default function SystemSettingsPage() {
  return <SettingsView />;
}
