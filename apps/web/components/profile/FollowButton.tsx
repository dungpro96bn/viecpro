'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/lib/format';
import { IconCheck, IconPlus } from '../ui/Icons';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import './profile.css';

export default function FollowButton({ kind, slug, initialFollowing = false }: { kind: 'employers' | 'recruiters'; slug: string; initialFollowing?: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user) return;
    void apiRequest<{ following?: boolean }>(`/${kind}/${encodeURIComponent(slug)}`).then((profile) => {
      setFollowing(profile.following ?? false);
    }).catch(() => undefined);
  }, [user, kind, slug]);
  const toggle = async () => {
    if (!user) return router.push('/dang-nhap');
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>(`/${kind}/${encodeURIComponent(slug)}/follow`, { method: following ? 'DELETE' : 'PUT' });
      setFollowing((value) => !value);
    } catch {
      setError('Không cập nhật được trạng thái theo dõi.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <span>
      <button type="button" className={cx('follow-btn', following && 'follow-btn--active')} aria-pressed={following} disabled={busy} onClick={() => void toggle()}>
        {following ? <IconCheck size={17} /> : <IconPlus size={17} />}
        <span>{busy ? 'Đang cập nhật…' : following ? 'Đang theo dõi' : 'Theo dõi'}</span>
      </button>
      {error && <span role="status" className="visually-hidden">{error}</span>}
    </span>
  );
}
