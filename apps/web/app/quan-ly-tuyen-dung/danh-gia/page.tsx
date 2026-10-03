import type { Metadata } from 'next';
import ReviewsView from './ReviewsView';
import './reviews.css';

export const metadata: Metadata = { title: 'Đánh giá' };

export default function EmployerReviewsPage() {
  return <ReviewsView />;
}
