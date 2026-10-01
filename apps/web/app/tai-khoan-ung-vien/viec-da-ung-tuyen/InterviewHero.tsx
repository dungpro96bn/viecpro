'use client';

import { useEffect, useState } from 'react';
import { MEETING_PLATFORM_LABEL, type ApplicationItem, type MeetingPlatform } from '@viecpro/shared';
import { IconCalendar, IconCheck, IconVideo } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { hourMinute } from '@/lib/employer';
import { cx } from '@/lib/format';
import { countdown } from '@/lib/seeker';
import { addToCalendar, interviewPlace, longWhen } from './interview-utils';

/** Danh sách chuẩn bị chỉ lưu trên trình duyệt này (tiện ích cá nhân) */
const prepKey = (id: string) => `vp-interview-prep-${id}`;

/** Thẻ phỏng vấn sắp tới đầu trang (design 19) */
export default function InterviewHero({ item, onChange }: { item: ApplicationItem; onChange: (a: ApplicationItem) => void }) {
  const iv = item.interview!;
  const [, tick] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  // Đếm ngược cập nhật mỗi phút
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(prepKey(iv.id)) ?? '[]') as number[]);
    } catch {
      setDone([]);
    }
  }, [iv.id]);
  const toggleDone = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(prepKey(iv.id), JSON.stringify(next));
    } catch {
      // Không lưu được thì vẫn dùng trong phiên này
    }
  };

  const platform = MEETING_PLATFORM_LABEL[iv.platform as MeetingPlatform] ?? 'phòng họp';
  const prep =
    iv.kind === 'online'
      ? [
          { title: `Thử link ${platform} và micro`, hint: 'Mở trước 15 phút' },
          { title: 'Tập giới thiệu bản thân bằng tiếng Nhật', hint: 'はじめまして… khoảng 1 phút' },
          { title: 'Chuẩn bị CCCD, mặc áo sơ mi', hint: 'Ngồi nơi yên tĩnh, đủ sáng' },
        ]
      : [
          { title: 'Xem đường đến địa điểm', hint: iv.location ? `${iv.location} · đến sớm 15 phút` : 'Đến sớm 15 phút' },
          { title: 'Tập giới thiệu bản thân bằng tiếng Nhật', hint: 'はじめまして… khoảng 1 phút' },
          { title: 'Mang CCCD, bằng cấp bản gốc', hint: 'Mặc gọn gàng, lịch sự' },
        ];
  const who = [...iv.interviewers, ...(iv.partnerName ? ['đại diện xí nghiệp Nhật (có phiên dịch)'] : [])].join(' và ');

  const call = async (path: string, body?: object) => {
    setBusy(true);
    setError('');
    try {
      onChange(await apiRequest<ApplicationItem>(`/me/applications/${encodeURIComponent(item.id)}/interview/${path}`, { method: 'POST', ...(body && { body: JSON.stringify(body) }) }));
      return true;
    } catch (e) {
      setError(e instanceof ApiClientError && e.fields?.reason ? e.fields.reason : apiMessage(e, 'Không gửi được. Vui lòng thử lại.'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submitChange = async () => {
    if (reason.trim().length < 5) return setError('Cho cán bộ biết lý do và giờ bạn rảnh');
    if (await call('change-request', { reason: reason.trim() })) {
      setAsking(false);
      setSent(true);
      setReason('');
    }
  };

  return (
    <section className="ap-hero" aria-label="Phỏng vấn sắp tới">
      <div className="ap-hero__main">
        <span className="ap-hero__badges">
          <span className="ap-hero__pill">
            <i />
            Phỏng vấn sắp tới
          </span>
          <span className="ap-hero__count">{countdown(iv.startAt)}</span>
        </span>
        <b className="ap-hero__when">{longWhen(iv.startAt, iv.endAt)}</b>
        <span className="ap-hero__place">{interviewPlace(item)}</span>
        {who && (
          <span className="ap-hero__who">
            {item.consultant?.photoUrl && <img src={item.consultant.photoUrl} alt="" />}
            {who}
          </span>
        )}
        <span className="ap-hero__actions">
          {iv.kind === 'online' &&
            (iv.meetingUrl ? (
              <a href={iv.meetingUrl} target="_blank" rel="noreferrer" className="ap-hero__btn ap-hero__btn--primary">
                <IconVideo size={15} />
                Vào phòng {platform}
              </a>
            ) : (
              <span className="ap-hero__btn ap-hero__btn--ghost" title="Link gửi qua Zalo và hiện tại đây trước giờ hẹn 15 phút">
                <IconVideo size={15} />
                Link {platform} mở lúc {hourMinute(iv.linkOpensAt)}
              </span>
            ))}
          <button type="button" className="ap-hero__btn ap-hero__btn--white" onClick={() => addToCalendar(item)}>
            <IconCalendar size={15} />
            Thêm vào lịch
          </button>
          {iv.myStatus === 'pending' && !sent && (
            <button type="button" className="ap-hero__btn ap-hero__btn--white" disabled={busy} onClick={() => void call('confirm')}>
              <IconCheck size={15} />
              Xác nhận tham gia
            </button>
          )}
          {!asking && !sent && (
            <button type="button" className="ap-hero__link" onClick={() => (setAsking(true), setError(''))}>
              Xin dời lịch
            </button>
          )}
          {iv.myStatus === 'confirmed' && <span className="ap-hero__confirmed">✓ Bạn đã xác nhận tham gia</span>}
          {sent && <span className="ap-hero__confirmed">Đã gửi yêu cầu đổi giờ – cán bộ sẽ gọi lại cho bạn</span>}
        </span>
        {asking && (
          <form className="ap-hero__ask" noValidate onSubmit={(e) => (e.preventDefault(), void submitChange())}>
            <label className="visually-hidden" htmlFor="change-reason">
              Lý do xin đổi giờ
            </label>
            <textarea id="change-reason" rows={2} maxLength={300} value={reason} aria-invalid={!!error} placeholder="VD: Em bận đi khám sức khoẻ sáng thứ Năm, em rảnh chiều thứ Sáu hoặc cả ngày thứ Bảy ạ." onChange={(e) => setReason(e.target.value)} />
            <span className="ap-hero__ask-actions">
              <button type="button" className="ap-hero__link" onClick={() => setAsking(false)}>
                Huỷ
              </button>
              <button type="submit" className="ap-hero__btn ap-hero__btn--white" disabled={busy}>
                {busy ? 'Đang gửi…' : 'Gửi cho cán bộ'}
              </button>
            </span>
          </form>
        )}
        {error && (
          <p className="ap-hero__error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="ap-prep">
        <span className="ap-prep__head">
          <b>Chuẩn bị phỏng vấn</b>
          <small>
            {done.length}/{prep.length} đã xong
          </small>
        </span>
        <span className="ap-prep__bar">
          <i style={{ width: `${(done.length / prep.length) * 100}%` }} />
        </span>
        <ul className="ap-prep__list">
          {prep.map((p, i) => (
            <li key={p.title}>
              <button type="button" role="checkbox" aria-checked={done.includes(i)} className={cx('ap-prep__item', done.includes(i) && 'ap-prep__item--done')} onClick={() => toggleDone(i)}>
                <span className="ap-prep__box">{done.includes(i) && <IconCheck size={11} />}</span>
                <span className="ap-prep__text">
                  <b>{p.title}</b>
                  <small>{p.hint}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
