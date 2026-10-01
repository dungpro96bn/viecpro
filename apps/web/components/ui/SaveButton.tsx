'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cx } from '@/lib/format';
import { IconHeart } from './Icons';
import type { SavedJobState } from '@viecpro/shared';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import './ui.css';

/** Nút lưu việc làm (trái tim trong vòng tròn) */
export default function SaveButton({
  jobId,
  initialSaved = false,
  size = 'md',
  syncState = false,
}: {
  jobId: string;
  initialSaved?: boolean;
  size?: 'md' | 'lg';
  /** Tự hỏi API trạng thái đã lưu (trang render ở server không biết người xem là ai) */
  syncState?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setSaved(initialSaved), [initialSaved]);

  useEffect(() => {
    if (!syncState || !user) return;
    let active = true;
    void apiRequest<SavedJobState>(`/me/saved-jobs/${encodeURIComponent(jobId)}`)
      .then((state) => { if (active) setSaved(state.saved); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [syncState, user, jobId]);

  const toggle = async () => {
    if (!user) {
      router.push('/dang-nhap');
      return;
    }
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>(`/me/saved-jobs/${encodeURIComponent(jobId)}`, { method: saved ? 'DELETE' : 'PUT' });
      setSaved((current) => !current);
    } catch {
      setError('Không thể cập nhật việc đã lưu. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="save-btn-wrap" title={error || undefined}>
      <button
        type="button"
        className={cx('save-btn', size === 'lg' && 'save-btn--lg', saved && 'save-btn--active')}
        aria-pressed={saved}
        aria-label={saved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <IconHeart size={size === 'lg' ? 20 : 18} className="save-btn__icon" />
      </button>
      {error && <span className="visually-hidden" role="status">{error}</span>}
    </span>
  );
}
