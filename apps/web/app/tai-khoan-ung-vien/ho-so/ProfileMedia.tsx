'use client';

import { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  SEEKER_DOCUMENT_LABEL,
  SEEKER_DOCUMENT_STATUS_LABEL,
  SEEKER_SELF_UPLOAD_DOCUMENTS,
  type SeekerDocument,
  type SeekerDocumentKey,
  type SeekerProfile,
  type SeekerProfileInsights,
} from '@viecpro/shared';
import { IconCamera, IconCheck, IconClock, IconEye, IconFile, IconPlay, IconUpload, IconVideo } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { timeAgo, zaloHref } from '@/lib/employer';
import { cx } from '@/lib/format';
import { uploadAsset } from '@/lib/upload';
import { SectionCard, type SaveProfile } from './ProfileSections';

/** Chọn tệp → tải lên kho → gọi `onUploaded(path)`; trả trạng thái bận / lỗi */
function useUpload(kind: 'image' | 'video', onUploaded: (path: string) => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { assetPath } = await uploadAsset(file, kind);
      await onUploaded(assetPath);
    } catch (err) {
      setError(apiMessage(err, err instanceof Error ? err.message : 'Không tải được tệp.'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, pick };
}

/* ---------- Ảnh đại diện (đầu mục Cá nhân) ---------- */
export function AvatarRow({ profile, save }: { profile: SeekerProfile; save: SaveProfile }) {
  const up = useUpload('image', (path) => save({ avatarUrl: path }));
  return (
    <div className="sp-avatar" id="anh-dai-dien">
      <span className="sp-avatar__img">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <IconCamera size={20} />}</span>
      <span className="sp-avatar__text">
        <b>{profile.avatarUrl ? 'Ảnh đại diện' : 'Chưa có ảnh đại diện'}</b>
        <small>Ảnh rõ mặt, nền sáng · JPG / PNG, tối đa 5 MB</small>
        {up.error && (
          <small className="sp-form__error" role="alert">
            {up.error}
          </small>
        )}
      </span>
      <label className={cx('btn btn--outline btn--sm', up.busy && 'sp-busy')}>
        <IconUpload size={14} />
        {up.busy ? 'Đang tải…' : profile.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
        <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={up.busy} onChange={(e) => void up.pick(e)} />
      </label>
    </div>
  );
}

/* ---------- 5. Giấy tờ xuất cảnh ---------- */
const DOC_TONE: Record<SeekerDocument['status'], string> = { verified: 'ok', uploaded: 'ok', processing: 'wait', missing: 'todo' };

export function DocumentsSection({ profile, onChange, preview, consultantPhone }: { profile: SeekerProfile; onChange: (docs: SeekerDocument[]) => void; preview: boolean; consultantPhone: string | null }) {
  const ready = profile.documents.filter((d) => d.status === 'verified' || d.status === 'uploaded').length;
  return (
    <SectionCard
      id="giay-to"
      icon={<IconFile size={18} />}
      tone="cyan"
      title="Giấy tờ xuất cảnh"
      desc="Chuẩn bị sớm giúp rút ngắn thời gian chờ xuất cảnh 3 – 4 tuần."
      action={<span className={cx('sp-ready', ready === profile.documents.length && 'sp-ready--done')}>{ready}/{profile.documents.length} đã sẵn sàng</span>}
    >
      <ul className="sp-docs">
        {profile.documents.map((d) => (
          <DocCard key={d.key} doc={d} preview={preview} onChange={onChange} consultantPhone={consultantPhone} />
        ))}
      </ul>
      {!preview && <p className="sp-note">ViecPro không nhận hoặc lưu CCCD. Với giấy tờ định danh khác, vui lòng xác minh trực tiếp cùng đơn vị phái cử.</p>}
    </SectionCard>
  );
}

function DocCard({ doc, preview, onChange, consultantPhone }: { doc: SeekerDocument; preview: boolean; onChange: (docs: SeekerDocument[]) => void; consultantPhone: string | null }) {
  const selfUpload = (SEEKER_SELF_UPLOAD_DOCUMENTS as readonly SeekerDocumentKey[]).includes(doc.key);
  const up = useUpload('image', async (path) => onChange(await apiRequest<SeekerDocument[]>(`/me/profile/documents/${doc.key}`, { method: 'PUT', body: JSON.stringify({ path }) })));
  const tone = DOC_TONE[doc.status];
  const status = doc.status === 'processing' && doc.note ? `${SEEKER_DOCUMENT_STATUS_LABEL.processing} · ${doc.note}` : SEEKER_DOCUMENT_STATUS_LABEL[doc.status];
  return (
    <li className={cx('sp-doc', `sp-doc--${tone}`)}>
      <span className="sp-doc__icon">{tone === 'ok' ? <IconCheck size={14} /> : tone === 'wait' ? <IconClock size={14} /> : <IconUpload size={14} />}</span>
      <b className="sp-doc__name">{SEEKER_DOCUMENT_LABEL[doc.key]}</b>
      {doc.status !== 'missing' || preview ? (
        <span className="sp-doc__status">{doc.status === 'missing' ? 'Chưa có' : status}</span>
      ) : selfUpload ? (
        <label className="sp-doc__status sp-doc__action">
          {up.busy ? 'Đang tải…' : 'Tải lên ngay'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={up.busy} onChange={(e) => void up.pick(e)} />
        </label>
      ) : consultantPhone ? (
        // Chưa có API: kho giấy tờ riêng tư mã hoá – tạm gửi bản chụp cho cán bộ qua Zalo
        <a className="sp-doc__status sp-doc__action" href={zaloHref(consultantPhone)} target="_blank" rel="noreferrer">
          Gửi cho cán bộ
        </a>
      ) : (
        <span className="sp-doc__status">Chưa có</span>
      )}
      {up.error && (
        <small className="sp-form__error" role="alert">
          {up.error}
        </small>
      )}
    </li>
  );
}

/* ---------- 6. Video giới thiệu ---------- */
const VIDEO_TIPS = ['Chào bằng tiếng Nhật: はじめまして、…です', 'Giới thiệu quê quán, kinh nghiệm và lý do muốn sang Nhật', 'Quay nơi đủ sáng, mặc áo sơ mi gọn gàng'];

export function VideoSection({ profile, save, preview }: { profile: SeekerProfile; save: SaveProfile; preview: boolean }) {
  const up = useUpload('video', (path) => save({ videoUrl: path }));
  const [removing, setRemoving] = useState(false);
  const given = profile.name.trim().split(/\s+/).pop();
  const remove = async () => {
    if (!window.confirm('Xoá video giới thiệu khỏi hồ sơ?')) return;
    setRemoving(true);
    try {
      await save({ videoUrl: null });
    } finally {
      setRemoving(false);
    }
  };
  if (preview && !profile.videoUrl) return null;
  return (
    <section className="sp-card sp-video" id="video" aria-labelledby="video-title">
      <div className={cx('sp-video__player', !profile.videoUrl && 'sp-video__player--empty')}>
        {profile.videoUrl ? (
          <video src={profile.videoUrl} controls preload="metadata" />
        ) : (
          <span className="sp-video__placeholder">
            <span className="sp-video__play">
              <IconPlay size={18} />
            </span>
            Chưa có video
          </span>
        )}
      </div>
      <div className="sp-video__body">
        <span className="sp-video__head">
          <h2 className="sp-card__title" id="video-title">
            Video giới thiệu 30 giây
          </h2>
          <span className="sp-badge sp-badge--green">Được xem nhiều gấp 3 lần</span>
        </span>
        <p className="sp-video__desc">Nhà tuyển dụng Nhật rất coi trọng thái độ và tác phong. Một video ngắn giúp bạn nổi bật hơn hàng trăm hồ sơ khác.</p>
        {!preview && (
          <>
            <ul className="sp-checks">
              {VIDEO_TIPS.map((t) => (
                <li key={t}>
                  <IconCheck size={13} />
                  {t.replace('…', given ?? '')}
                </li>
              ))}
            </ul>
            <span className="sp-video__actions">
              {/* capture: điện thoại mở camera trước để quay ngay */}
              <label className={cx('btn btn--primary btn--sm', up.busy && 'sp-busy')}>
                <IconVideo size={14} />
                {up.busy ? 'Đang tải lên…' : 'Quay video ngay'}
                <input type="file" accept="video/mp4" capture="user" className="visually-hidden" disabled={up.busy} onChange={(e) => void up.pick(e)} />
              </label>
              <label className={cx('btn btn--outline btn--sm', up.busy && 'sp-busy')}>
                <IconUpload size={14} />
                Tải video lên
                <input type="file" accept="video/mp4" className="visually-hidden" disabled={up.busy} onChange={(e) => void up.pick(e)} />
              </label>
              {profile.videoUrl && (
                <button type="button" className="sp-link-danger" disabled={removing} onClick={() => void remove()}>
                  {removing ? 'Đang xoá…' : 'Xoá video'}
                </button>
              )}
            </span>
            <small className="sp-hint">Video MP4, tối đa 50 MB.</small>
            {up.error && (
              <small className="sp-form__error" role="alert">
                {up.error}
              </small>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- Nhà tuyển dụng đã xem ---------- */
export function ViewersSection({ insights }: { insights: SeekerProfileInsights | null }) {
  return (
    <SectionCard id="ntd-da-xem" icon={<IconEye size={18} />} title="Nhà tuyển dụng đã xem hồ sơ" desc="Chỉ hiện các doanh nghiệp đã xác minh trên viecpro (30 ngày gần đây).">
      {!insights ? (
        <p className="sp-empty">Đang tải…</p>
      ) : insights.viewers.length ? (
        <ul className="sp-viewers">
          {insights.viewers.map((v) => (
            <li key={v.employer.id}>
              <Link href={`/nha-tuyen-dung/${v.employer.slug}`} className="sp-viewer">
                <span className="sp-viewer__logo">{v.employer.logoUrl ? <img src={v.employer.logoUrl} alt="" /> : initials(v.employer.name)}</span>
                <span className="sp-viewer__text">
                  <b>{v.employer.name}</b>
                  <small>{v.count > 1 ? `Xem ${v.count} lần · ${timeAgo(v.lastAt)}` : timeAgo(v.lastAt)}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sp-empty">Chưa có doanh nghiệp nào xem hồ sơ. Bật “Cho phép nhà tuyển dụng tìm thấy tôi” và hoàn thiện hồ sơ để được chú ý hơn.</p>
      )}
    </SectionCard>
  );
}

/** "Công ty TNHH Minh Phát Global" → "MP" (bỏ tiền tố loại hình công ty) */
function initials(name: string): string {
  const words = name.replace(/^(Công ty|CTY)\s+(TNHH|CP|Cổ phần)?\s*/i, '').split(/\s+/).filter((w) => /^[A-ZÀ-Ỹ]/.test(w));
  return words.slice(0, 2).map((w) => w.charAt(0)).join('') || name.charAt(0);
}
