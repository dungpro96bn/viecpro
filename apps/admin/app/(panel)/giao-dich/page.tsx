import type { Metadata } from 'next';
import TransactionsView from './TransactionsView';
import '@/components/list/list.css';
export const metadata: Metadata = { title: 'Giao dịch' };
export default function TransactionsPage(){return <TransactionsView/>;}
