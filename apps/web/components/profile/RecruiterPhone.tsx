'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';

export default function RecruiterPhone({ slug, initial }: { slug: string; initial: string }) {
  const [phone, setPhone] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  const reveal = async () => {
    if (!user) return router.push('/dang-nhap');
    if (loading || phone !== initial) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<{ phone: string }>(`/recruiters/${encodeURIComponent(slug)}/phone`);
      setPhone(result.phone);
    } catch {
      setError('Không tải được số điện thoại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return <><button type="button" className="contact-item__value contact-item__value--button" onClick={() => void reveal()} disabled={loading}>{loading ? 'Đang tải…' : phone}</button>{error && <span className="contact-item__label" role="status">{error}</span>}</>;
}
