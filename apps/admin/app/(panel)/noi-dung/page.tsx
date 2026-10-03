import type { Metadata } from 'next';
import ContentView from './ContentView';
import '../admin-tools.css';

export const metadata: Metadata = { title: 'Nội dung trang chủ' };

export default function HomepageContentPage() {
  return <ContentView />;
}
