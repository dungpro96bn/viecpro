'use client';

import { useEffect, useState } from 'react';
import type { SystemSettings } from '@viecpro/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/list/list-utils';

const EMPTY: SystemSettings = { supportPhone: '19006688', supportEmail: 'hotro@viecpro.vn', maintenanceMode: false, maintenanceMessage: 'ViecPro đang bảo trì. Vui lòng quay lại sau.' };

export default function SettingsView() {
  const { can } = useAuth();
  const [form, setForm] = useState<SystemSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void api<SystemSettings>('/admin/tools/system').then((data) => active && setForm(data)).catch((e) => active && setError(errorText(e))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      setForm(await api<SystemSettings>('/admin/tools/system', { method: 'PATCH', body: JSON.stringify(form) }));
      setSuccess('Đã lưu cài đặt hệ thống. Chế độ bảo trì áp dụng cho API trong vài giây.');
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
          <h1 className="page-header__title">Cài đặt hệ thống</h1>
        </span>
      </header>
      <div className="page-body at-layout">
        {form.maintenanceMode && <div className="at-notice">Đang bật bảo trì. API người dùng sẽ trả trạng thái 503; tài khoản quản trị và trang trạng thái vẫn truy cập được.</div>}
        <section className="at-panel">
          <h2>Liên hệ và vận hành</h2>
          {loading ? <p className="at-muted">Đang tải cài đặt…</p> : (
            <div className="at-form-grid" style={{ maxWidth: 800 }}>
              <label className="at-field">Hotline<input className="at-input" maxLength={24} value={form.supportPhone} onChange={(e) => setForm((s) => ({ ...s, supportPhone: e.target.value }))} /></label>
              <label className="at-field">Email hỗ trợ<input className="at-input" type="email" maxLength={254} value={form.supportEmail} onChange={(e) => setForm((s) => ({ ...s, supportEmail: e.target.value }))} /></label>
              <label className="at-field at-field--check at-span-all"><input type="checkbox" checked={form.maintenanceMode} onChange={(e) => setForm((s) => ({ ...s, maintenanceMode: e.target.checked }))} /> Bật chế độ bảo trì cho API người dùng</label>
              <label className="at-field at-span-all">Thông báo bảo trì<textarea className="at-textarea" maxLength={240} value={form.maintenanceMessage} onChange={(e) => setForm((s) => ({ ...s, maintenanceMessage: e.target.value }))} /></label>
            </div>
          )}
          <p className="at-muted">Hotline và email cập nhật ở chân trang web. Khi bật bảo trì, các API dành cho người dùng tạm trả 503; API quản trị vẫn mở để tắt bảo trì.</p>
          <div className="at-actions"><button type="button" className="at-btn at-btn--primary" disabled={loading || busy || !can('settings.manage')} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button></div>
          {error && <p className="at-error" role="alert">{error}</p>}
          {success && <p className="at-success" role="status">{success}</p>}
        </section>
      </div>
    </>
  );
}
