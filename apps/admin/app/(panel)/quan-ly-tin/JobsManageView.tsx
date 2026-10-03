'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { INDUSTRIES, PREFECTURES, type AdminJobUpdateInput } from '@viecpro/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/list/list-utils';

interface JobItem {
  id: string;
  code: string;
  title: string;
  status: string;
  employer: string;
  updatedAt: string;
}
interface JobList { items: JobItem[]; total: number; page: number; limit: number; hasMore: boolean }
interface JobEdit extends AdminJobUpdateInput { id: string; code: string; status: string; employer: string }

const STATUS: Record<string, string> = { open: 'Đang hiển thị', pending: 'Chờ duyệt', draft: 'Nháp', paused: 'Tạm ẩn', closed: 'Đã đóng', rejected: 'Bị từ chối' };

export default function JobsManageView() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<JobList | null>(null);
  const [selected, setSelected] = useState<JobEdit | null>(null);
  const [form, setForm] = useState<AdminJobUpdateInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (submittedQ) params.set('q', submittedQ);
      const next = await api<JobList>(`/admin/tools/jobs?${params}`);
      setList(next);
      if (selected && !next.items.some((j) => j.id === selected.id)) {
        setSelected(null);
        setForm(null);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [page, submittedQ, selected]);

  useEffect(() => { void load(); }, [load]);

  const choose = async (item: JobItem) => {
    setError('');
    setSuccess('');
    try {
      const detail = await api<JobEdit>(`/admin/tools/jobs/${encodeURIComponent(item.id)}`);
      setSelected(detail);
      setForm({ title: detail.title, industry: detail.industry, pref: detail.pref, salary: detail.salary, quantity: detail.quantity, description: detail.description });
    } catch (e) {
      setError(errorText(e));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !form || !can('jobs.manage')) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api<JobEdit>(`/admin/tools/jobs/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify(form) });
      setSelected(updated);
      setForm({ title: updated.title, industry: updated.industry, pref: updated.pref, salary: updated.salary, quantity: updated.quantity, description: updated.description });
      setSuccess(`Đã lưu ${updated.code}. Trạng thái duyệt được giữ nguyên.`);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const change = <K extends keyof AdminJobUpdateInput>(key: K, value: AdminJobUpdateInput[K]) => setForm((current) => current ? { ...current, [key]: value } : current);

  return (
    <>
      <header className="page-header">
        <span className="page-header__titles">
          <span className="page-header__meta">Quản trị viecpro</span>
          <h1 className="page-header__title">Sửa tin thay nhà tuyển dụng</h1>
        </span>
      </header>
      <div className="page-body at-jobs">
        <section className="at-panel">
          <h2>Danh sách tin</h2>
          <p className="at-muted">Chỉnh sửa nội dung tin và lưu nhật ký. Trạng thái kiểm duyệt, mã tin và nhà tuyển dụng không đổi.</p>
          <form className="at-toolbar" onSubmit={(e) => { e.preventDefault(); setPage(1); setSubmittedQ(q.trim()); }}>
            <input className="at-input" aria-label="Tìm tin" placeholder="Tìm theo mã hoặc tiêu đề" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="at-btn" type="submit">Tìm</button>
          </form>
          {loading && <p className="at-muted">Đang tải danh sách…</p>}
          <div className="at-list">
            {list?.items.map((item) => (
              <button key={item.id} type="button" className={`at-list-item${selected?.id === item.id ? ' at-list-item--active' : ''}`} onClick={() => void choose(item)}>
                <span><b>{item.title}</b></span>
                <span className="at-list-item__meta">{item.code} · {STATUS[item.status] ?? item.status} · {item.employer}</span>
              </button>
            ))}
          </div>
          {list && <div className="at-actions"><span className="at-muted">{list.total.toLocaleString('vi-VN')} tin</span><button className="at-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button><span className="at-muted">Trang {page}</span><button className="at-btn" disabled={!list.hasMore} onClick={() => setPage((p) => p + 1)}>Sau</button></div>}
        </section>

        <section className="at-panel">
          <h2>{selected ? `${selected.code} · ${selected.employer}` : 'Chọn tin để chỉnh sửa'}</h2>
          {selected && form ? (
            <form onSubmit={(e) => void submit(e)}>
              <div className="at-form-grid">
                <label className="at-field at-span-all">Tiêu đề<input className="at-input" minLength={10} maxLength={160} required value={form.title} onChange={(e) => change('title', e.target.value)} /></label>
                <label className="at-field">Ngành nghề<select className="at-select" value={form.industry} onChange={(e) => change('industry', e.target.value as AdminJobUpdateInput['industry'])}>{INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="at-field">Tỉnh thành<select className="at-select" value={form.pref} onChange={(e) => change('pref', e.target.value)}>{PREFECTURES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="at-field">Lương cơ bản (¥/tháng)<input className="at-input" type="number" min={50000} max={1000000} step={1000} required value={form.salary} onChange={(e) => change('salary', Number(e.target.value))} /></label>
                <label className="at-field">Số lượng tuyển<input className="at-input" type="number" min={1} max={500} required value={form.quantity} onChange={(e) => change('quantity', Number(e.target.value))} /></label>
                <label className="at-field at-span-all">Mô tả công việc<textarea className="at-textarea" maxLength={3000} rows={7} value={form.description} onChange={(e) => change('description', e.target.value)} /></label>
              </div>
              <p className="at-muted">Trạng thái hiện tại: {STATUS[selected.status] ?? selected.status}. Nếu cần thay đổi trạng thái, dùng màn hình kiểm duyệt.</p>
              <div className="at-actions"><button className="at-btn at-btn--primary" type="submit" disabled={saving || !can('jobs.manage')}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
            </form>
          ) : <p className="at-muted">Chọn một tin trong danh sách để tải nội dung.</p>}
          {error && <p className="at-error" role="alert">{error}</p>}
          {success && <p className="at-success" role="status">{success}</p>}
        </section>
      </div>
    </>
  );
}
