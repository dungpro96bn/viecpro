import type { Metadata } from 'next';
import TrashOverview from './TrashOverview';

export const metadata: Metadata = {
  title: 'Thùng rác',
};

export default function EmployerTrashPage() {
  return <TrashOverview />;
}
