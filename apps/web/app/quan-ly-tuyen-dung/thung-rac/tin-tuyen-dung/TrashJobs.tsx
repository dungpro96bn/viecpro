'use client';

import { useCallback, useEffect, useState } from 'react';
import { JOB_STATUS_LABEL, TRASH_RETENTION_DAYS, type Paginated, type TrashedJob } from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import Pager from '@/components/employer/Pager';
import ConfirmTypeDialog from '@/components/ui/ConfirmTypeDialog';
import { IconArrowLeft, IconBriefcaseLine, IconCheck, IconTrash } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { timeAgo } from '@/lib/employer';
import TrashHeader from '../TrashHeader';
import { daysLeft, purgeLabel } from '../trash-expiry';
import '../trash.css';

const PER_PAGE = 20;

/** Thùng rác → Tin tuyển dụng đã xoá: khôi phục (giữ trạng thái lúc xoá) hoặc xoá vĩnh viễn (gõ lại mã tin) */
export default function TrashJobs() {
  const { refresh } = useEmployerAccount();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<TrashedJob> | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [purging, setPurging] = useState<TrashedJob | null>(null);
  const [purgeError, setPurgeError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<Paginated<TrashedJob>>(`/employer/trash/jobs?page=${page}&limit=${PER_PAGE}`));
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

  const restore = async (job: TrashedJob) => {
    setBusyId(job.id);
    setError('');
    setNotice('');
    try {
      await apiRequest<void>(`/employer/trash/jobs/${job.id}/restore`, { method: 'POST' });
      await after(`Đã khôi phục tin ${job.code} về mục “${JOB_STATUS_LABEL[job.status]}”.`);
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
      await apiRequest<void>(`/employer/trash/jobs/${purging.id}/purge`, { method: 'POST', body: JSON.stringify({ confirm: typed }) });
      const code = purging.code;
      setPurging(null);
      await after(`Đã xoá vĩnh viễn tin ${code}.`);
    } catch (e) {
      setPurgeError(apiMessage(e, 'Không xoá được.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="tr">
      <TrashHeader current="Tin tuyển dụng đã xoá" />
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
          <IconBriefcaseLine size={28} />
          <b>Không có tin nào trong thùng rác</b>
          <span>Tin nháp, bị từ chối hoặc đã đóng mà bạn xoá sẽ nằm ở đây {TRASH_RETENTION_DAYS} ngày để khôi phục khi cần.</span>
        </div>
      )}

      {data && data.items.length > 0 && (
        <section className="emp-card tr-card" aria-label="Tin tuyển dụng đã xoá">
          <ul className="tr-list">
            {data.items.map((job) => (
              <li key={job.id} className="tr-row">
                <span className="tr-row__icon" aria-hidden="true">
                  <IconBriefcaseLine size={20} />
                </span>
                <span className="tr-row__who">
                  <b>{job.title}</b>
                  <small>
                    {job.code} · {JOB_STATUS_LABEL[job.status]}
                  </small>
                </span>
                <span className="tr-row__meta">
                  <span>
                    Xoá {timeAgo(job.removedAt)}
                    {job.removedBy && ` bởi ${job.removedBy}`}
                  </span>
                  <small>{job.applications ? `${job.applications} hồ sơ ứng tuyển vẫn theo dõi ở mục Ứng viên` : 'Chưa có hồ sơ ứng tuyển'}</small>
                  <small className={daysLeft(job.purgeAt) <= 3 ? 'tr-row__expiry tr-row__expiry--soon' : 'tr-row__expiry'}>{purgeLabel(job.purgeAt)}</small>
                </span>
                <span className="tr-row__actions">
                  <button type="button" className="emp-btn emp-btn--sm" disabled={busyId === job.id} onClick={() => void restore(job)}>
                    <IconArrowLeft size={14} />
                    {busyId === job.id && !purging ? 'Đang khôi phục…' : 'Khôi phục'}
                  </button>
                  <button
                    type="button"
                    className="emp-btn emp-btn--sm tr-danger"
                    disabled={busyId === job.id}
                    onClick={() => {
                      setPurgeError('');
                      setPurging(job);
                    }}
                  >
                    <IconTrash size={14} />
                    Xoá vĩnh viễn
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <Pager page={data.page} perPage={data.limit} total={data.total} shown={data.items.length} noun="tin" onPage={setPage} />
        </section>
      )}

      <ConfirmTypeDialog
        open={!!purging}
        title={`Xoá vĩnh viễn tin ${purging?.code ?? ''}?`}
        confirmText={purging?.confirmText ?? ''}
        actionLabel="Xoá vĩnh viễn"
        busy={!!purging && busyId === purging.id}
        error={purgeError}
        consequences={[
          'Trang tin bị gỡ hẳn và không khôi phục được.',
          'Tin bị bỏ khỏi danh sách “Việc đã lưu” của ứng viên.',
          `${purging?.applications ?? 0} hồ sơ ứng tuyển vẫn được giữ; ứng viên thấy tin ở trạng thái “Tin đã bị gỡ”.`,
        ]}
        onConfirm={(typed) => void purge(typed)}
        onClose={() => setPurging(null)}
      />
    </div>
  );
}
