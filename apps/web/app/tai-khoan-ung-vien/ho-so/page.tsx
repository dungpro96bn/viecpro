import type { Metadata } from 'next';
import MyProfile from './MyProfile';
import './profile.css';

export const metadata: Metadata = {
  title: 'Hồ sơ của tôi',
};

export default function SeekerProfilePage() {
  return <MyProfile />;
}
