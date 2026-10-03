'use client';

import { useState } from 'react';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/list/list-utils';

type Dataset = 'jobs' | 'employers' | 'applications' | 'users';
interface ExportLink { downloadPath: string; rows: number; truncated: boolean; expiresAt: string }

const LABEL: Record<Dataset, string> = { jobs: 'Tin tuyển dụng', employers: 'Nhà tuyển dụng', applications: 'Hồ sơ ứng tuyển', users: 'Tài khoản người dùng' };

export default function ExportView() {
  const { can } = useAuth();
  const [dataset, setDataset] = useState<Dataset>('jobs');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<ExportLink>('/admin/tools/exports', { method: 'POST', body: JSON.stringify({ dataset }) });
      const expires = new Date(result.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setMessage(`Đang tải ${result.rows.toLocaleString('vi-VN')} dòng${result.truncated ? ' (đã giới hạn ở 10.000 dòng)' : ''}. Link hết hạn lúc ${expires} và chỉ dùng một lần.`);
      window.location.assign(`${API_URL}${result.downloadPath}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <span className="page-header__titles">
          <span className="page-header__meta">Quản trị viecpro</span>
          <h1 className="page-header__title">Xuất dữ liệu</h1>
        </span>
      </header>
      <div className="page-body at-layout">
        <section className="at-panel">
          <h2>Tạo file CSV</h2>
          <p className="at-muted">Mỗi file tối đa 10.000 dòng. Link tải ngẫu nhiên, chỉ dùng một lần và tự hết hạn sau 15 phút. Dữ liệu tài khoản và ứng tuyển cần thêm quyền xem thông tin cá nhân.</p>
          <label className="at-field" style={{ maxWidth: 520, marginTop: 18 }}>Loại dữ liệu
            <select className="at-select" value={dataset} onChange={(e) => setDataset(e.target.value as Dataset)}>
              {(Object.keys(LABEL) as Dataset[]).map((key) => {
                const piiLocked = (key === 'users' || key === 'applications') && !can('users.pii');
                return <option key={key} value={key} disabled={piiLocked}>{LABEL[key]}{piiLocked ? ' (cần users.pii)' : ''}</option>;
              })}
            </select>
          </label>
          <div className="at-actions"><button type="button" className="at-btn at-btn--primary" disabled={busy || !can('data.export')} onClick={() => void create()}>{busy ? 'Đang tạo link…' : 'Tạo và tải CSV'}</button></div>
          {error && <p className="at-error" role="alert">{error}</p>}
          {message && <p className="at-success" role="status">{message}</p>}
        </section>
      </div>
    </>
  );
}
