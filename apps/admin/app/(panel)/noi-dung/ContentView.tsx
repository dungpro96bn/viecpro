'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { HomepageContent } from '@viecpro/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/list/list-utils';

type BannerKey = 'employerBanner' | 'courseBanner';

function TextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="at-field">{label}{multiline ? <textarea className="at-textarea" maxLength={240} value={value} onChange={(e) => onChange(e.target.value)} /> : <input className="at-input" maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />}</label>;
}

function BannerEditor({ title, value, onChange }: { title: string; value: HomepageContent['employerBanner']; onChange: (next: HomepageContent['employerBanner']) => void }) {
  const field = (key: keyof typeof value, label: string, multiline = false): ReactNode => (
    <TextField key={key} label={label} value={value[key] as string} multiline={multiline} onChange={(next) => onChange({ ...value, [key]: next })} />
  );
  return (
    <section className="at-panel">
      <div className="at-toolbar"><h2 style={{ margin: 0 }}>{title}</h2><label className="at-field at-field--check"><input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} /> Đang hiển thị</label></div>
      <div className="at-form-grid">
        {field('image', 'Ảnh (đường dẫn /... hoặc HTTPS)')}
        {field('tag', 'Nhãn')}
        {field('title', 'Tiêu đề')}
        {field('cta', 'Nút kêu gọi')}
        {field('href', 'Liên kết (đường dẫn /... hoặc HTTPS)')}
        {field('description', 'Mô tả ngắn', true)}
      </div>
    </section>
  );
}

export default function ContentView() {
  const { can } = useAuth();
  const [content, setContent] = useState<HomepageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void api<HomepageContent>('/admin/tools/homepage').then((data) => active && setContent(data)).catch((e) => active && setError(errorText(e))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const setBanner = (key: BannerKey, value: HomepageContent['employerBanner']) => setContent((current) => current ? { ...current, [key]: value } : current);
  const setAd = (id: string, patch: Partial<HomepageContent['miniAds'][number]>) => setContent((current) => current ? { ...current, miniAds: current.miniAds.map((ad) => ad.id === id ? { ...ad, ...patch } : ad) } : current);

  const save = async () => {
    if (!content) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      setContent(await api<HomepageContent>('/admin/tools/homepage', { method: 'PATCH', body: JSON.stringify(content) }));
      setSuccess('Đã cập nhật nội dung trang chủ.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const addAd = () => setContent((current) => current && current.miniAds.length < 8 ? {
    ...current,
    miniAds: [...current.miniAds, { id: `ad-${Date.now().toString(36)}`, enabled: true, image: '/images/banners/banner-1.jpg', tag: 'Dịch vụ', title: 'Tiêu đề quảng cáo', cta: 'Tìm hiểu thêm', href: '/tim-kiem' }],
  } : current);

  return (
    <>
      <header className="page-header">
        <span className="page-header__titles">
          <span className="page-header__meta">Quản trị viecpro</span>
          <h1 className="page-header__title">Nội dung trang chủ</h1>
        </span>
      </header>
      <div className="page-body at-layout">
        <p className="at-muted">Chỉnh banner nhà tuyển dụng, quảng cáo khóa học và danh sách quảng cáo dịch vụ hiển thị ở trang chủ. Ảnh nhận đường dẫn nội bộ hoặc HTTPS; link chỉ chấp nhận HTTPS/đường dẫn nội bộ.</p>
        {loading && <section className="at-panel"><p className="at-muted">Đang tải nội dung…</p></section>}
        {content && <>
          <BannerEditor title="Banner nhà tuyển dụng" value={content.employerBanner} onChange={(v) => setBanner('employerBanner', v)} />
          <BannerEditor title="Quảng cáo khóa học" value={content.courseBanner} onChange={(v) => setBanner('courseBanner', v)} />
          <section className="at-panel">
            <div className="at-toolbar"><h2 style={{ margin: 0 }}>Quảng cáo dịch vụ</h2><button type="button" className="at-btn" disabled={content.miniAds.length >= 8} onClick={addAd}>Thêm quảng cáo</button></div>
            <TextField label="Tiêu đề nhóm" value={content.miniAdsTitle} onChange={(miniAdsTitle) => setContent({ ...content, miniAdsTitle })} />
            <div className="at-ad-list">
              {content.miniAds.map((ad, index) => (
                <div className="at-ad" key={ad.id}>
                  <div className="at-toolbar"><b>Quảng cáo {index + 1}</b><label className="at-field at-field--check"><input type="checkbox" checked={ad.enabled} onChange={(e) => setAd(ad.id, { enabled: e.target.checked })} /> Đang hiển thị</label><button type="button" className="at-btn at-btn--danger" onClick={() => setContent({ ...content, miniAds: content.miniAds.filter((item) => item.id !== ad.id) })}>Xoá</button></div>
                  <div className="at-form-grid">
                    <TextField label="Ảnh (đường dẫn /... hoặc HTTPS)" value={ad.image} onChange={(image) => setAd(ad.id, { image })} />
                    <TextField label="Nhãn" value={ad.tag} onChange={(tag) => setAd(ad.id, { tag })} />
                    <TextField label="Tiêu đề" value={ad.title} onChange={(title) => setAd(ad.id, { title })} />
                    <TextField label="Nút kêu gọi" value={ad.cta} onChange={(cta) => setAd(ad.id, { cta })} />
                    <TextField label="Liên kết" value={ad.href} onChange={(href) => setAd(ad.id, { href })} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="at-actions"><button type="button" className="at-btn at-btn--primary" disabled={busy || !can('content.manage')} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu nội dung trang chủ'}</button></div>
        </>}
        {error && <p className="at-error" role="alert">{error}</p>}
        {success && <p className="at-success" role="status">{success}</p>}
      </div>
    </>
  );
}
