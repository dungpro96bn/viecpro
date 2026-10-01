'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { SeekerProfile, SeekerProfileInput, SeekerProfileInsights } from '@viecpro/shared';
import { useSeekerAccount } from '@/components/seeker/SeekerAccountProvider';
import { IconArrowUp, IconCamera, IconChatSquare, IconDownload, IconEye, IconMail, IconPin, IconUser, IconVideo } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { cx } from '@/lib/format';
import { completionLevel, sectionDone, type ProfileSectionKey } from '@/lib/seeker';
import { AvatarRow, DocumentsSection, VideoSection, ViewersSection } from './ProfileMedia';
import { ExperienceSection, PersonalSection, SkillsSection, WishesSection } from './ProfileSections';

const TABS: Array<{ key: ProfileSectionKey; label: string; anchor: string }> = [
  { key: 'personal', label: 'Cá nhân', anchor: 'ca-nhan' },
  { key: 'wishes', label: 'Nguyện vọng', anchor: 'nguyen-vong' },
  { key: 'experience', label: 'Kinh nghiệm', anchor: 'kinh-nghiem' },
  { key: 'skills', label: 'Tiếng Nhật & kỹ năng', anchor: 'ky-nang' },
  { key: 'documents', label: 'Giấy tờ', anchor: 'giay-to' },
  { key: 'video', label: 'Video', anchor: 'video' },
];

/** Gợi ý bổ sung (key từ API) → nội dung thẻ + nơi cần đến */
const SUGGESTION: Record<string, { title: string; hint: string; icon: ReactNode; anchor: string }> = {
  avatar: { title: 'Thêm ảnh đại diện', hint: 'Ảnh rõ mặt, nền sáng', icon: <IconCamera size={16} />, anchor: 'anh-dai-dien' },
  jlpt: { title: 'Chứng chỉ tiếng Nhật', hint: 'Hoặc làm bài test 10 phút', icon: <IconChatSquare size={16} />, anchor: 'ky-nang' },
  video: { title: 'Video giới thiệu', hint: 'Chỉ cần 30 giây', icon: <IconVideo size={16} />, anchor: 'video' },
  email: { title: 'Thêm email', hint: 'Nhận đơn mới mỗi tuần', icon: <IconMail size={16} />, anchor: 'ca-nhan' },
  about: { title: 'Giới thiệu bản thân', hint: '2 – 3 câu về bạn', icon: <IconUser size={16} />, anchor: 'ca-nhan' },
  hometown: { title: 'Thêm quê quán', hint: 'Đơn ưu tiên theo vùng', icon: <IconPin size={16} />, anchor: 'ca-nhan' },
  prefs: { title: 'Tỉnh Nhật Bản quan tâm', hint: 'Nhận gợi ý đúng vùng', icon: <IconPin size={16} />, anchor: 'nguyen-vong' },
  programs: { title: 'Chương trình quan tâm', hint: 'TTS, kỹ năng đặc định…', icon: <IconPin size={16} />, anchor: 'nguyen-vong' },
  industries: { title: 'Ngành nghề quan tâm', hint: 'Chọn 1 – 3 ngành', icon: <IconPin size={16} />, anchor: 'nguyen-vong' },
};

const scrollTo = (anchor: string) => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Hồ sơ của tôi (design 18) */
export default function MyProfile() {
  const { profile, setProfile, dashboard } = useSeekerAccount();
  const [insights, setInsights] = useState<SeekerProfileInsights | null>(null);
  const [preview, setPreview] = useState(false);
  const [toggleError, setToggleError] = useState('');

  useEffect(() => {
    void apiRequest<SeekerProfileInsights>('/me/profile/insights').then(setInsights).catch(() => setInsights({ views: { last7Days: 0, delta: 0 }, matchingJobs: 0, viewers: [] }));
  }, []);

  const save = async (patch: SeekerProfileInput) => {
    const next = await apiRequest<SeekerProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    setProfile(next);
    return next;
  };

  /** Công tắc lưu ngay, lỗi thì trả lại trạng thái cũ */
  const toggle = async (key: 'lookingForJob' | 'discoverable') => {
    const prev = profile;
    setToggleError('');
    setProfile({ ...profile, [key]: !profile[key] });
    try {
      await save({ [key]: !prev[key] });
    } catch (e) {
      setProfile(prev);
      setToggleError(apiMessage(e, 'Không lưu được thay đổi.'));
    }
  };

  const done = sectionDone(profile);
  const tips = profile.suggestions.filter((s) => SUGGESTION[s.key]).slice(0, 3);
  const pct = profile.completion;
  const views = insights?.views;

  return (
    <div className={cx('sp', preview && 'sp--preview')}>
      <div className="sp-head">
        <span>
          <h1 className="sp-head__title">Hồ sơ của tôi</h1>
          <p className="sp-head__desc">Nhà tuyển dụng thấy đúng hồ sơ này khi bạn ứng tuyển 1 chạm.</p>
        </span>
        <span className="sp-head__actions">
          <button type="button" className={cx('btn btn--outline btn--sm', preview && 'sp-head__on')} aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
            <IconEye size={15} />
            {preview ? 'Thoát chế độ xem' : 'Xem như nhà tuyển dụng'}
          </button>
          {/* Chưa có API: xuất CV PDF từ server – tạm dùng hộp thoại in của trình duyệt (chọn "Lưu thành PDF") */}
          <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
            <IconDownload size={15} />
            Tải CV (PDF)
          </button>
        </span>
      </div>

      {preview && (
        <p className="sp-preview-note" role="status">
          <IconEye size={15} />
          Bạn đang xem hồ sơ như nhà tuyển dụng. {profile.discoverable ? 'Số điện thoại được che cho tới khi bạn ứng tuyển.' : 'Hồ sơ đang ẩn – nhà tuyển dụng chỉ thấy khi bạn ứng tuyển.'}
        </p>
      )}

      {!preview && (
        <section className="sp-card sp-summary" aria-label="Mức hoàn thiện hồ sơ">
          <div className="sp-summary__top">
            <span className="sp-ring" style={{ ['--pct' as string]: `${pct}%` }}>
              <b>{pct}%</b>
              <small>hoàn thiện</small>
            </span>
            <span className="sp-summary__text">
              <span className="sp-summary__level">
                <b>{completionLevel(pct)}</b>
                {tips.length > 0 && <span className="sp-badge sp-badge--orange">Cần bổ sung</span>}
              </span>
              <p>{tips.length ? `Hoàn thiện ${tips.length} mục dưới đây để được nhà tuyển dụng xem nhiều hơn khoảng 2,5 lần.` : 'Hồ sơ đã đầy đủ – nhà tuyển dụng ưu tiên liên hệ hồ sơ như của bạn.'}</p>
            </span>
            <span className="sp-stat">
              <b>{views?.last7Days ?? '–'}</b>
              <small>lượt NTD xem trong 7 ngày</small>
              {views && views.delta !== 0 && (
                <span className={cx('sp-stat__delta', views.delta < 0 && 'sp-stat__delta--down')}>
                  <IconArrowUp size={11} />
                  {Math.abs(views.delta)} so với tuần trước
                </span>
              )}
            </span>
            <span className="sp-stat">
              <b>{insights?.matchingJobs ?? dashboard.newMatchingJobs}</b>
              <small>đơn đang tuyển phù hợp với bạn</small>
              <Link href="/tim-kiem" className="sp-stat__link">
                Xem gợi ý →
              </Link>
            </span>
          </div>

          {tips.length > 0 && (
            <ul className="sp-tips">
              {tips.map((t) => {
                const s = SUGGESTION[t.key]!;
                return (
                  <li key={t.key}>
                    <button type="button" className="sp-tip" onClick={() => (t.key === 'avatar' ? document.getElementById('avatar-input')?.click() : scrollTo(s.anchor))}>
                      <span className="sp-tip__icon">{s.icon}</span>
                      <span className="sp-tip__text">
                        <b>{s.title}</b>
                        <small>{s.hint}</small>
                      </span>
                      <span className="sp-tip__gain">+{t.gain}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="sp-toggles">
            <Toggle title="Đang tìm việc" desc="Hiện nhãn “Đang tìm việc” với nhà tuyển dụng" on={profile.lookingForJob} onToggle={() => void toggle('lookingForJob')} />
            <Toggle title="Cho phép nhà tuyển dụng tìm thấy tôi" desc="Ẩn số điện thoại cho tới khi bạn ứng tuyển" on={profile.discoverable} onToggle={() => void toggle('discoverable')} />
          </div>
          {toggleError && (
            <p className="sp-form__error" role="alert">
              {toggleError}
            </p>
          )}
        </section>
      )}

      <nav className="sp-tabs" aria-label="Các mục hồ sơ">
        {TABS.map((t) => (
          <button key={t.key} type="button" className="sp-tabs__item" onClick={() => scrollTo(t.anchor)}>
            <i className={cx('sp-tabs__dot', done[t.key] ? 'sp-tabs__dot--done' : 'sp-tabs__dot--todo')} aria-hidden="true" />
            {t.label}
            <span className="visually-hidden">{done[t.key] ? '(đã đủ)' : '(cần bổ sung)'}</span>
          </button>
        ))}
      </nav>

      <PersonalSection profile={profile} save={save} preview={preview} avatar={<AvatarRow profile={profile} save={save} />} />
      <WishesSection profile={profile} save={save} preview={preview} />
      <ExperienceSection profile={profile} save={save} preview={preview} />
      <SkillsSection profile={profile} save={save} preview={preview} />
      <DocumentsSection profile={profile} preview={preview} consultantPhone={dashboard.consultantContact?.phone ?? null} onChange={(documents) => setProfile({ ...profile, documents })} />
      <VideoSection profile={profile} save={save} preview={preview} />
      {!preview && <ViewersSection insights={insights} />}
    </div>
  );
}

function Toggle({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <span className="sp-toggle">
      <span className="sp-toggle__text">
        <b>{title}</b>
        <small>{desc}</small>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={title} className={cx('sp-switch', on && 'sp-switch--on')} onClick={onToggle}>
        <span className="sp-switch__knob" />
      </button>
    </span>
  );
}
