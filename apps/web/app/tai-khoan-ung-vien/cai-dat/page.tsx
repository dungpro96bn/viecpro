import type { Metadata } from 'next';
import SeekerSettings from './SeekerSettings';
import './settings.css';

export const metadata: Metadata = {
  title: 'Cài đặt',
};

export default function SeekerSettingsPage() {
  return <SeekerSettings />;
}
