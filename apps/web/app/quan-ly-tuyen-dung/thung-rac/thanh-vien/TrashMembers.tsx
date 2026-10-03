'use client';

import { useCallback, useEffect, useState } from 'react';
import { TRASH_RETENTION_DAYS, type Paginated, type TrashedMember } from '@viecpro/shared';
import ApplicantAvatar from '@/components/employer/ApplicantAvatar';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import Pager from '@/components/employer/Pager';
import ConfirmTypeDialog from '@/components/ui/ConfirmTypeDialog';
import { IconArrowLeft, IconCheck, IconMembers, IconTrash } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { displayPhone, timeAgo } from '@/lib/employer';
import TrashHeader from '../TrashHeader';
import { daysLeft, purgeLabel } from '../trash-expiry';
import '../trash.css';

const PER_PAGE = 20;

/** Thùng rác → Thành viên đã xoá: khôi phục hoặc xoá vĩnh viễn (gõ lại tên) */
export default function TrashMembers() {
  const { refresh } = useEmployerAccount();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<TrashedMember> | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [purging, setPurging] = useState<TrashedMember | null>(null);
  const [purgeError, setPurgeError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<Paginated<TrashedMember>>(`/employer/trash/members?page=${page}&limit=${PER_PAGE}`));
      setError('');
    } catch (e) {
      setError(apiMessage(e, 'Không tải được thùng rác.'));
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);

  const after = async (message: string) => {
    setNotice(message);
    await load();
    void refresh();
  };

  const restore = async (m: TrashedMember) => {
    setBusyId(m.id);
    setError('');
    setNotice('');
    try {
      await apiRequest<void>(`/employer/trash/members/${m.id}/restore`, { method: 'POST' });
      await after(`Đã khôi phục ${m.name}. ${m.hasAccount ? 'Thành viên đăng nhập lại để tiếp tục làm việc.' : ''}`);
    } catch (e) {
      setError(apiMessage(e, 'Không khôi phục được.'));
    } finally {
      setBusyId('');
    }
  };

  const purge = async (typed: string) => {
    if (!purging) return;
    setBusyId(purging.id);
    setPurgeError('');
    try {
      await apiRequest<void>(`/employer/trash/members/${purging.id}/purge`, { method: 'POST', body: JSON.stringify({ confirm: typed }) });
      const name = purging.name;
      setPurging(null);
      await after(`Đã xoá vĩnh viễn ${name}.`);
    } catch (e) {
      setPurgeError(apiMessage(e, 'Không xoá được.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="tr">
      <TrashHeader current="Thành viên đã xoá" />
      {error && (
        <div className="emp-state emp-state--error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="tr-done" role="status">
          <IconCheck size={15} />
          {notice}
        </p>
      )}
      {!data && !error && <div className="emp-card tr-skeleton" aria-busy="true" />}

      {data && !data.items.length && (
        <div className="emp-card tr-empty">
          <IconMembers size={28} />
          <b>Không có thành viên nào trong thùng rác</b>
          <span>Thành viên bị xoá ở trang Thành viên sẽ nằm ở đây {TRASH_RETENTION_DAYS} ngày để khôi phục khi cần.</span>
        </div>
      )}

      {data && data.items.length > 0 && (
        <section className="emp-card tr-card" aria-label="Thành viên đã xoá">
          <ul className="tr-list">
            {data.items.map((m) => (
              <li key={m.id} className="tr-row">
                {m.photoUrl ? <img className="tr-row__photo" src={m.photoUrl} alt="" /> : <ApplicantAvatar name={m.name} />}
                <span className="tr-row__who">
                  <b>{m.name}</b>
                  <small>
                    {m.title}
                    {m.phone && ` · ${displayPhone(m.phone)}`}
                    {!m.hasAccount && ' · Hồ sơ hiển thị'}
                  </small>
                </span>
                <span className="tr-row__meta">
                  <span>
                    Xoá {timeAgo(m.removedAt)}
                    {m.removedBy && ` bởi ${m.removedBy}`}
                  </span>
                  <small>
                    Giữ lịch sử: {m.keptJobs} tin, {m.keptNotes} ghi chú
                  </small>
                  <small className={daysLeft(m.purgeAt) <= 3 ? 'tr-row__expiry tr-row__expiry--soon' : 'tr-row__expiry'}>{purgeLabel(m.purgeAt)}</small>
                </span>
                <span className="tr-row__actions">
                  <button type="button" className="emp-btn emp-btn--sm" disabled={busyId === m.id} onClick={() => void restore(m)}>
                    <IconArrowLeft size={14} />
                    {busyId === m.id && !purging ? 'Đang khôi phục…' : 'Khôi phục'}
                  </button>
                  <button
                    type="button"
                    className="emp-btn emp-btn--sm tr-danger"
                    disabled={busyId === m.id}
                    onClick={() => {
                      setPurgeError('');
                      setPurging(m);
                    }}
                  >
                    <IconTrash size={14} />
                    Xoá vĩnh viễn
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <Pager page={data.page} perPage={data.limit} total={data.total} shown={data.items.length} noun="thành viên" onPage={setPage} />
        </section>
      )}

      <ConfirmTypeDialog
        open={!!purging}
        title={`Xoá vĩnh viễn ${purging?.name ?? ''}?`}
        confirmText={purging?.name ?? ''}
        actionLabel="Xoá vĩnh viễn"
        busy={!!purging && busyId === purging.id}
        error={purgeError}
        consequences={[
          'Tên, số điện thoại, email, ảnh và hồ sơ công khai bị xoá – không khôi phục được.',
          purging?.hasAccount ? 'Tài khoản đăng nhập bị vô hiệu; số điện thoại được giải phóng để có thể mời lại sau.' : 'Hồ sơ hiển thị bị gỡ khỏi viecpro.',
          `Lịch sử (${purging?.keptJobs ?? 0} tin, ${purging?.keptNotes ?? 0} ghi chú) vẫn giữ nhưng hiển thị là “Thành viên đã xoá”.`,
        ]}
        onConfirm={(typed) => void purge(typed)}
        onClose={() => setPurging(null)}
      />
    </div>
  );
}
