import type { Metadata } from 'next';
import ModerationView from './ModerationView';
import '@/components/list/list.css';
import './moderation.css';

export const metadata: Metadata = { title: 'Kiểm duyệt tin' };

export default function ModerationPage() {
  return <ModerationView />;
}
