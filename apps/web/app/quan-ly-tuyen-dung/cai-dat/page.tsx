import type { Metadata } from 'next';
import ProfileSettings from './ProfileSettings';

export const metadata: Metadata = {
  title: 'Cài đặt hồ sơ',
};

export default function EmployerSettingsPage() {
  return <ProfileSettings />;
}
