'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  INTERVIEW_KIND_LABEL,
  MEETING_PLATFORMS,
  MEETING_PLATFORM_LABEL,
  type EmployerInterviewItem,
  type InterviewAvailability,
  type InterviewCandidate,
  type InterviewKind,
  type InviteChannel,
  type MeetingPlatform,
  type TeamMember,
} from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import ApplicantAvatar from '@/components/employer/ApplicantAvatar';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { CheckCard, Field, FormSection, OptionGroup, toggleIn } from '@/components/form/FormKit';
import MatchBadge from '@/components/employer/MatchBadge';
import { IconBuilding, IconCalendar, IconCheck, IconClock, IconCloseSmall, IconLink, IconPlus, IconSearch, IconSend, IconTeam, IconTrophy, IconVideo } from '@/components/ui/Icons';
import { ApiClientError, apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, initialOf, shortName, weekdayLong, weekdayShort } from '@/lib/employer';
import { cx } from '@/lib/format';

const DAY = 86400_000;
const OPEN = 8 * 60; // 08:00
const CLOSE = 18 * 60; // 18:00
const LUNCH = [12 * 60, 13 * 60 + 30] as const;
const SLOTS = Array.from({ length: (CLOSE - OPEN) / 30 }, (_, i) => OPEN + i * 30);
const DURATIONS = [30, 45, 60, 90, 120] as const;
const DRAFT_KEY = 'vp-interview-draft';

const KINDS: Array<{ key: InterviewKind; desc: string; icon: typeof IconVideo; tone: string; duration: number }> = [
  { key: 'online', desc: 'Qua Zoom / Google Meet, ứng viên ở quê vẫn tham gia được.', icon: IconVideo, tone: 'blue', duration: 60 },
  { key: 'onsite', desc: 'Tại văn phòng, kiểm tra ngoại hình, thể lực, giấy tờ gốc.', icon: IconBuilding, tone: 'orange', duration: 45 },
  { key: 'skill_test', desc: 'Bài thi thực hành theo nhóm tại xưởng, chấm điểm trực tiếp.', icon: IconTrophy, tone: 'violet', duration: 120 },
];
const CHANNELS: Array<{ value: InviteChannel; label: string }> = [
  { value: 'zalo', label: 'Zalo' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

interface Draft {
  kind: InterviewKind;
  dayIndex: number;
  time: number | null;
  duration: number;
  platform: MeetingPlatform;
  autoLink: boolean;
  meetingUrl: string;
  location: string;
  interviewerIds: string[];
  withPartner: boolean;
  partnerName: string;
  channels: InviteChannel[];
  remind24h: boolean;
  remind2h: boolean;
  note: string;
}

const EMPTY: Draft = {
  kind: 'online',
  dayIndex: 1,
  time: null,
  duration: 60,
  platform: 'zoom',
  autoLink: true,
  meetingUrl: '',
  location: '',
  interviewerIds: [],
  withPartner: false,
  partnerName: '',
  channels: ['zalo', 'sms'],
  remind24h: true,
  remind2h: true,
  note: '',
};

type Busy = InterviewAvailability['days'][number]['busy'][number];

/** Tạo lịch hẹn (design 17) */
export default function CreateInterviewForm() {
  const router = useRouter();
  const { account } = useEmployerAccount();
  const [d, setD] = useState<Draft>(EMPTY);
  const [picked, setPicked] = useState<InterviewCandidate[]>([]);
  const [waiting, setWaiting] = useState<InterviewCandidate[]>([]);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState<InterviewAvailability['days']>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setD((x) => ({ ...x, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
    setDraftSaved(false);
  };

  const today = useMemo(startOfToday, []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY)), [today]);

  // Khởi tạo: ứng viên chọn sẵn (?app=), đội ngũ, lịch bận, bản nháp
  useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get('app');
    void apiRequest<InterviewCandidate[]>(`/employer/interviews/candidates${ids ? `?ids=${encodeURIComponent(ids)}` : ''}`).then((list) => {
      const pre = ids ? list.filter((c) => ids.split(',').includes(c.applicationId)) : [];
      setPicked(pre);
      setWaiting(list.filter((c) => !pre.includes(c)));
    });
    void apiRequest<TeamMember[]>('/employer/team').then((t) => {
      setTeam(t);
      setD((x) => (x.interviewerIds.length ? x : { ...x, interviewerIds: t.filter((m) => m.isMe).map((m) => m.id) }));
    });
    void apiRequest<InterviewAvailability>(`/employer/interviews/availability?from=${encodeURIComponent(startOfToday().toISOString())}&days=7`).then((a) => setBusy(a.days));
    if (!ids) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) setD({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>), dayIndex: 1, time: null });
      } catch {
        // Bản nháp chỉ là tiện ích, bỏ qua nếu trình duyệt chặn lưu trữ
      }
    }
  }, []);

  // Tìm ứng viên đang chờ hẹn
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      void apiRequest<InterviewCandidate[]>(`/employer/interviews/candidates?q=${encodeURIComponent(q.trim())}`).then(setWaiting);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const busyOn = (dayIndex: number, ids: string[]): Busy[] => (busy[dayIndex]?.busy ?? []).filter((b) => ids.includes(b.recruiterId));
  const isFree = (dayIndex: number, start: number, ids: string[]) => {
    const day = days[dayIndex]!;
    const end = start + d.duration;
    if (day.getDay() === 0 || end > CLOSE) return false;
    if (start < LUNCH[1] && end > LUNCH[0]) return false;
    if (day.getTime() + start * 60_000 < Date.now() + 30 * 60_000) return false;
    return !busyOn(dayIndex, ids).some((b) => minutesOf(b.start) < end && minutesOf(b.end) > start);
  };
  const freeSlots = (dayIndex: number) => SLOTS.filter((s) => isFree(dayIndex, s, d.interviewerIds));

  // Bỏ giờ đã chọn nếu không còn trống (đổi người phỏng vấn / thời lượng)
  useEffect(() => {
    if (d.time !== null && busy.length && !isFree(d.dayIndex, d.time, d.interviewerIds)) setD((x) => ({ ...x, time: null }));
  }, [d.interviewerIds, d.duration, d.dayIndex, busy]);

  const pickKind = (k: InterviewKind) => {
    setD((x) => ({ ...x, kind: k, duration: KINDS.find((m) => m.key === k)!.duration }));
    setErrors({});
  };
  const addCandidate = (c: InterviewCandidate) => {
    setPicked((p) => (p.length >= 30 || p.some((x) => x.applicationId === c.applicationId) ? p : [...p, c]));
    setWaiting((w) => w.filter((x) => x.applicationId !== c.applicationId));
    setErrors((e) => ({ ...e, applicationIds: '' }));
  };
  const removeCandidate = (c: InterviewCandidate) => {
    setPicked((p) => p.filter((x) => x.applicationId !== c.applicationId));
    setWaiting((w) => [c, ...w]);
  };

  const day = days[d.dayIndex]!;
  const selectedPeople = team.filter((m) => d.interviewerIds.includes(m.id));
  const endTime = d.time !== null ? d.time + d.duration : null;
  const dateLabel = `${weekdayLong(day)}, ${dayMonth(day, true)}`;
  const timeLabel = d.time !== null ? `${hm(d.time)} – ${hm(endTime!)}` : 'Chưa chọn giờ';
  const placeLabel = d.kind === 'online' ? `${MEETING_PLATFORM_LABEL[d.platform]} · ${d.autoLink ? 'link tự tạo' : d.meetingUrl || 'chưa có link'}` : d.location || 'Chưa có địa điểm';
  const companyName = account.company?.shortName ?? account.company?.name ?? account.user.name;
  const host = selectedPeople[0]?.name ?? account.user.name;
  const suggestions = freeSlots(d.dayIndex).slice(0, 4);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!picked.length) e.applicationIds = 'Chọn ít nhất 1 ứng viên';
    if (d.time === null) e.startAt = 'Chọn giờ bắt đầu';
    if (d.kind === 'online' && !d.autoLink && !/^https:\/\/\S+$/.test(d.meetingUrl.trim())) e.meetingUrl = 'Link phòng họp phải bắt đầu bằng https://';
    if (d.kind !== 'online' && d.location.trim().length < 3) e.location = 'Nhập địa điểm';
    if (!d.interviewerIds.length) e.interviewerIds = 'Chọn ít nhất 1 người phỏng vấn';
    if (d.withPartner && d.partnerName.trim().length < 2) e.partnerName = 'Nhập tên đối tác';
    return e;
  };

  const submit = async () => {
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.values(found).some(Boolean)) {
      setFormError('Vui lòng kiểm tra các trường được đánh dấu.');
      document.querySelector('.ef-field__error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      const item = await apiRequest<EmployerInterviewItem>('/employer/interviews', {
        method: 'POST',
        body: JSON.stringify({
          kind: d.kind,
          applicationIds: picked.map((c) => c.applicationId),
          startAt: new Date(day.getTime() + d.time! * 60_000).toISOString(),
          durationMinutes: d.duration,
          platform: d.kind === 'online' ? d.platform : undefined,
          // Chưa có API: tự tạo phòng họp Zoom / Meet – khi bật "tự tạo" thì chưa gửi link
          meetingUrl: d.kind === 'online' && !d.autoLink ? d.meetingUrl.trim() : undefined,
          location: d.kind !== 'online' ? d.location.trim() : undefined,
          interviewerIds: d.interviewerIds,
          partnerName: d.withPartner ? d.partnerName.trim() : undefined,
          channels: d.channels,
          remind24h: d.remind24h,
          remind2h: d.remind2h,
          note: d.note.trim() || undefined,
        }),
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // bỏ qua
      }
      router.push(`${EMPLOYER_BASE}/lich-phong-van?id=${item.id}`);
    } catch (e) {
      setFormError(apiMessage(e, 'Không tạo được lịch hẹn.'));
      if (e instanceof ApiClientError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k.split('.')[0]!, v])));
      if (e instanceof ApiClientError && e.code === 'SLOT_TAKEN') {
        void apiRequest<InterviewAvailability>(`/employer/interviews/availability?from=${encodeURIComponent(today.toISOString())}&days=7`).then((a) => setBusy(a.days));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => {
    try {
      const { dayIndex: _d, time: _t, ...rest } = d;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
      setDraftSaved(true);
    } catch {
      setFormError('Trình duyệt không cho lưu nháp.');
    }
  };

  return (
    <div className="ci">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <Link href={`${EMPLOYER_BASE}/lich-phong-van`}>Lịch phỏng vấn</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Tạo lịch hẹn</span>
          </nav>
          <h1 className="emp-page-head__title">Tạo lịch hẹn</h1>
        </span>
        <span className="emp-page-head__actions">
          <Link href={`${EMPLOYER_BASE}/lich-phong-van`} className="emp-btn ci-head-btn">
            Huỷ
          </Link>
          <button type="button" className="emp-btn emp-btn--primary ci-head-btn" disabled={saving} onClick={() => void submit()}>
            <IconSend size={15} />
            {saving ? 'Đang tạo…' : 'Tạo & gửi lời mời'}
          </button>
        </span>
      </div>

      <div className="ci-layout">
        <div className="ci-main">
          <FormSection num={1} title="Loại lịch hẹn" desc="Mỗi loại có mẫu lời mời và thời lượng gợi ý riêng.">
            <div className="ci-kinds" role="radiogroup" aria-label="Loại lịch hẹn">
              {KINDS.map((k) => (
                <button key={k.key} type="button" role="radio" aria-checked={d.kind === k.key} className={cx('ci-kind', d.kind === k.key && 'ci-kind--on')} onClick={() => pickKind(k.key)}>
                  <span className={cx('ci-kind__icon', `ci-kind__icon--${k.tone}`)}>
                    <k.icon size={18} />
                  </span>
                  <b>{INTERVIEW_KIND_LABEL[k.key]}</b>
                  <span className="ci-kind__desc">{k.desc}</span>
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection
            num={2}
            title="Ứng viên"
            desc="Có thể mời nhiều ứng viên cùng lúc cho buổi thi tay nghề hoặc phỏng vấn nhóm."
            aside={<span className="ci-count">{picked.length} ứng viên</span>}
          >
            {picked.length > 0 && (
              <div className="ci-picked">
                {picked.map((c) => (
                  <span key={c.applicationId} className="ci-chip">
                    <ApplicantAvatar name={c.fullName} size="sm" />
                    <span className="ci-chip__text">
                      <b>{c.fullName}</b>
                      <small>{c.jobShortTitle}</small>
                    </span>
                    <button type="button" className="ef-tag__remove" aria-label={`Bỏ ${c.fullName}`} onClick={() => removeCandidate(c)}>
                      <IconCloseSmall size={12} className="icon--w26" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {errors.applicationIds && (
              <span className="ef-field__error" role="alert">
                {errors.applicationIds}
              </span>
            )}
            <div className="ci-waiting">
              <span className="ci-waiting__head">
                <b>Ứng viên đang chờ hẹn ({waiting.length})</b>
                <span className="ci-search">
                  <IconSearch size={14} />
                  <input value={q} maxLength={80} placeholder="Tìm tên, số điện thoại" aria-label="Tìm ứng viên" onChange={(e) => setQ(e.target.value)} />
                </span>
              </span>
              <span className="emp-hint ci-waiting__sub">Sắp xếp theo % phù hợp</span>
              <ul className="ci-waiting__list">
                {waiting.slice(0, 6).map((c) => (
                  <li key={c.applicationId} className="ci-cand">
                    <ApplicantAvatar name={c.fullName} size="sm" />
                    <span className="ci-cand__text">
                      <b>{c.fullName}</b>
                      <small>
                        {c.gender === 'nu' ? 'Nữ' : 'Nam'} · {c.age}t{c.hometown ? ` · ${c.hometown}` : ''} · {c.jobShortTitle}
                      </small>
                    </span>
                    {c.matchScore !== null && <MatchBadge score={c.matchScore} />}
                    <button type="button" className="emp-btn emp-btn--md" onClick={() => addCandidate(c)}>
                      <IconPlus size={13} />
                      Thêm
                    </button>
                  </li>
                ))}
                {!waiting.length && <li className="emp-empty">Không có ứng viên đang chờ hẹn.</li>}
              </ul>
            </div>
          </FormSection>

          <FormSection num={3} title="Thời gian" desc="Khung giờ bận của người phỏng vấn đã được ẩn đi.">
            <Field label="Ngày" required>
              <div className="ci-days" role="radiogroup" aria-label="Ngày">
                {days.map((day, i) => {
                  const sunday = day.getDay() === 0;
                  const free = busy.length ? freeSlots(i).length : null;
                  const off = sunday || free === 0;
                  return (
                    <button key={i} type="button" role="radio" aria-checked={d.dayIndex === i} disabled={off} className={cx('ci-day', d.dayIndex === i && 'ci-day--on')} onClick={() => setD((x) => ({ ...x, dayIndex: i, time: null }))}>
                      <span className="ci-day__wd">{weekdayShort(day)}</span>
                      <b>{day.getDate()}</b>
                      <small>{sunday ? 'Nghỉ' : free === null ? '…' : free === 0 ? (i === 0 ? 'Đã qua' : 'Kín lịch') : `${free} khung trống`}</small>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Giờ bắt đầu" required error={errors.startAt} extra={d.time !== null ? `Giờ Việt Nam · ${hm(d.time + 120)} giờ Nhật` : 'Giờ Việt Nam'}>
              <div className="ci-slots" role="radiogroup" aria-label="Giờ bắt đầu">
                {SLOTS.map((s) => {
                  const free = isFree(d.dayIndex, s, d.interviewerIds);
                  return (
                    <button key={s} type="button" role="radio" aria-checked={d.time === s} disabled={!free} className={cx('ci-slot', d.time === s && 'ci-slot--on')} onClick={() => set('time', s)}>
                      {hm(s)}
                    </button>
                  );
                })}
              </div>
              <span className="ci-legend">
                <span className="ci-legend__item ci-legend__item--on">Đang chọn</span>
                <span className="ci-legend__item">Trống</span>
                <span className="ci-legend__item ci-legend__item--off">Người phỏng vấn bận / nghỉ trưa</span>
              </span>
            </Field>
            <Field label="Thời lượng">
              <OptionGroup label="Thời lượng" size="sm" options={DURATIONS.map((m) => ({ value: String(m), label: `${m} phút` }))} value={String(d.duration)} onChange={(v) => set('duration', Number(v))} />
            </Field>
          </FormSection>

          <FormSection num={4} title="Địa điểm" desc="Thông tin này được gửi kèm lời mời cho ứng viên.">
            {d.kind === 'online' ? (
              <>
                <Field label="Nền tảng">
                  <OptionGroup label="Nền tảng" size="sm" options={MEETING_PLATFORMS.map((p) => ({ value: p, label: MEETING_PLATFORM_LABEL[p] }))} value={d.platform} onChange={(v) => set('platform', v)} />
                </Field>
                <CheckCard checked={d.autoLink} onChange={() => set('autoLink', !d.autoLink)}>
                  Tự tạo phòng họp và gửi link kèm lời mời
                </CheckCard>
                {!d.autoLink && (
                  <Field label="Link phòng họp" required error={errors.meetingUrl}>
                    <span className="ef-affix emp-icon-input">
                      <IconLink size={15} />
                      <input className={cx('ef-input', errors.meetingUrl && 'ef-input--invalid')} value={d.meetingUrl} maxLength={300} placeholder="https://zoom.us/j/…" aria-invalid={!!errors.meetingUrl} onChange={(e) => set('meetingUrl', e.target.value)} />
                    </span>
                  </Field>
                )}
              </>
            ) : (
              <Field label={d.kind === 'skill_test' ? 'Địa điểm thi' : 'Địa chỉ văn phòng'} required error={errors.location}>
                <input className={cx('ef-input', errors.location && 'ef-input--invalid')} value={d.location} maxLength={200} placeholder="Số nhà, đường, quận / huyện, tỉnh" aria-invalid={!!errors.location} onChange={(e) => set('location', e.target.value)} />
              </Field>
            )}
            <Field label="Ghi chú cho ứng viên">
              <input className="ef-input" value={d.note} maxLength={500} placeholder={d.kind === 'online' ? 'VD: Chuẩn bị nơi yên tĩnh, camera rõ mặt' : 'VD: Mang giấy tờ và bằng cấp bản gốc'} onChange={(e) => set('note', e.target.value)} />
            </Field>
          </FormSection>

          <FormSection num={5} title="Người phỏng vấn" desc="Lịch hẹn sẽ được thêm vào lịch của từng người.">
            <div className="ci-people">
              {team.map((m) => {
                const count = busyOn(d.dayIndex, [m.id]).length;
                return (
                  <CheckCard key={m.id} checked={d.interviewerIds.includes(m.id)} onChange={() => set('interviewerIds', toggleIn(d.interviewerIds, m.id))} className="ci-person">
                    <span className="emp-avatar emp-avatar--sm emp-avatar--blue">{initialOf(m.name)}</span>
                    <span className="ci-person__text">
                      <b>
                        {m.name}
                        {m.isMe ? ' (bạn)' : ''}
                      </b>
                      <small className={cx(!count && 'ci-person__free')}>{count ? `${count} lịch bận ${dayMonth(day, true)}` : `Trống cả ngày ${dayMonth(day, true)}`}</small>
                    </span>
                  </CheckCard>
                );
              })}
            </div>
            {errors.interviewerIds && (
              <span className="ef-field__error" role="alert">
                {errors.interviewerIds}
              </span>
            )}
            <CheckCard checked={d.withPartner} onChange={() => set('withPartner', !d.withPartner)} className="ci-partner">
              <span className="ci-person__text">
                <b>Mời đối tác Nhật tham gia</b>
                <small>viecpro tự thêm phiên dịch viên vào phòng</small>
              </span>
            </CheckCard>
            {d.withPartner && (
              <Field label="Tên đối tác" required error={errors.partnerName}>
                <input className={cx('ef-input', errors.partnerName && 'ef-input--invalid')} value={d.partnerName} maxLength={120} placeholder="VD: Kenji Sato – Xí nghiệp Saitama" aria-invalid={!!errors.partnerName} onChange={(e) => set('partnerName', e.target.value)} />
              </Field>
            )}
          </FormSection>

          <FormSection num={6} title="Gửi lời mời & nhắc lịch" desc="Ứng viên bấm Xác nhận ngay trong tin nhắn.">
            <Field label="Kênh gửi">
              <div className="emp-chips">
                {CHANNELS.map((c) => (
                  <CheckCard key={c.value} checked={d.channels.includes(c.value)} onChange={() => set('channels', toggleIn(d.channels, c.value))}>
                    {c.label}
                  </CheckCard>
                ))}
              </div>
            </Field>
            <div className="ci-reminds">
              <Remind title="Nhắc trước 24 giờ" desc="Kèm nút Xác nhận / Xin đổi giờ" on={d.remind24h} onToggle={() => set('remind24h', !d.remind24h)} />
              <Remind title="Nhắc trước 2 giờ" desc="Gửi lại link hoặc chỉ đường" on={d.remind2h} onToggle={() => set('remind2h', !d.remind2h)} />
            </div>
          </FormSection>

          <div className="ef-footer">
            <span className="ef-footer__note">
              {formError ? (
                <span className="ef-footer__error" role="alert">
                  {formError}
                </span>
              ) : draftSaved ? (
                <>
                  <IconCheck size={15} className="icon--w24" />
                  Đã lưu nháp trên trình duyệt này
                </>
              ) : (
                <>
                  <IconSend size={15} />
                  Lời mời gửi ngay sau khi tạo{d.channels.length ? ` · ứng viên xác nhận qua ${CHANNELS.find((c) => c.value === d.channels[0])!.label}` : ''}
                </>
              )}
            </span>
            <button type="button" className="emp-btn" onClick={saveDraft}>
              Lưu nháp
            </button>
            <button type="button" className="emp-btn emp-btn--primary" disabled={saving} onClick={() => void submit()}>
              <IconSend size={15} />
              {saving ? 'Đang tạo…' : 'Tạo & gửi lời mời'}
            </button>
          </div>
        </div>

        <aside className="ci-side">
          <div className="ci-summary">
            <span className="ci-summary__kind">{INTERVIEW_KIND_LABEL[d.kind]}</span>
            <b className="ci-summary__title">
              {picked.length} ứng viên · {d.interviewerIds.length + (d.withPartner ? 1 : 0)} người phỏng vấn
            </b>
            <ul className="ci-summary__list">
              <li>
                <IconCalendar size={14} />
                {dateLabel} · {timeLabel}
              </li>
              <li>
                {d.kind === 'online' ? <IconVideo size={14} /> : <IconBuilding size={14} />}
                {placeLabel}
              </li>
              <li>
                <IconTeam size={14} />
                {[...selectedPeople.map((p) => p.name), ...(d.withPartner && d.partnerName ? [`${d.partnerName.split('–')[0]!.trim()} (+ phiên dịch)`] : [])].join(', ') || 'Chưa chọn người phỏng vấn'}
              </li>
              <li>
                <IconSend size={14} />
                {d.channels.length ? `Gửi qua ${d.channels.map((c) => CHANNELS.find((x) => x.value === c)!.label).join(', ')}` : 'Không gửi tin'}
                {d.remind24h || d.remind2h ? ` · nhắc ${[d.remind24h && '24h', d.remind2h && '2h'].filter(Boolean).join(' & ')}` : ''}
              </li>
            </ul>
          </div>

          <div className="emp-card emp-side-card">
            <span className="emp-side-card__head">
              <b className="emp-side-card__title">Lịch trống</b>
              <small className="emp-hint">{dateLabel}</small>
            </span>
            <div className="ci-timeline">
              <span className="ci-timeline__scale">
                {[8, 10, 12, 14, 16, 18].map((h) => (
                  <span key={h}>{h}h</span>
                ))}
              </span>
              {selectedPeople.map((p) => (
                <span key={p.id} className="ci-timeline__row">
                  <span className="ci-timeline__name">{shortName(p.name)}</span>
                  <span className="ci-timeline__track">
                    <span className="ci-timeline__lunch" style={{ left: `${((LUNCH[0] - OPEN) / (CLOSE - OPEN)) * 100}%`, width: `${((LUNCH[1] - LUNCH[0]) / (CLOSE - OPEN)) * 100}%` }} />
                    {busyOn(d.dayIndex, [p.id]).map((b) => {
                      const s = Math.max(minutesOf(b.start), OPEN);
                      const e = Math.min(minutesOf(b.end), CLOSE);
                      return e > s ? <span key={b.start} className="ci-timeline__busy" style={{ left: `${((s - OPEN) / (CLOSE - OPEN)) * 100}%`, width: `${((e - s) / (CLOSE - OPEN)) * 100}%` }} title={`${hm(s)} – ${hm(e)}`} /> : null;
                    })}
                    {d.time !== null && <span className="ci-timeline__pick" style={{ left: `${((d.time - OPEN) / (CLOSE - OPEN)) * 100}%`, width: `${(d.duration / (CLOSE - OPEN)) * 100}%` }} />}
                  </span>
                </span>
              ))}
            </div>
            {d.time !== null && selectedPeople.length > 0 && (
              <p className="ci-ok">
                <IconCheck size={13} className="icon--w3" />
                Tất cả người phỏng vấn đều trống lúc {timeLabel}.
              </p>
            )}
            <span className="emp-hint">Gợi ý khung giờ mọi người đều trống</span>
            <div className="ci-suggest">
              {suggestions.map((s) => (
                <button key={s} type="button" className={cx('ci-suggest__item', d.time === s && 'ci-suggest__item--on')} onClick={() => set('time', s)}>
                  <IconClock size={12} />
                  {hm(s)} – {hm(s + d.duration)}
                </button>
              ))}
              {!suggestions.length && <span className="emp-hint">Ngày này đã kín lịch, chọn ngày khác.</span>}
            </div>
          </div>

          <div className="emp-card emp-side-card">
            <b className="emp-side-card__title">Xem trước tin {d.channels[0] === 'sms' ? 'SMS' : d.channels[0] === 'email' ? 'email' : 'Zalo'}</b>
            <div className="ci-preview">
              <span className="ci-preview__from">
                <span className="emp-avatar emp-avatar--sm emp-avatar--blue">{initialOf(companyName)}</span>
                <b>{companyName}</b>
              </span>
              <div className="ci-preview__bubble">
                <b>Lời mời {d.kind === 'skill_test' ? 'thi tay nghề' : 'phỏng vấn'}</b>
                <p>
                  Chào {picked[0] ? picked[0].fullName.trim().split(/\s+/).pop() : 'bạn'}, {companyName} mời bạn tham gia {d.kind === 'online' ? 'phỏng vấn online' : d.kind === 'onsite' ? 'phỏng vấn trực tiếp' : 'thi tay nghề'} cho đơn {picked[0]?.jobShortTitle ?? '…'}.
                </p>
                <p className="ci-preview__meta">
                  <IconClock size={12} />
                  {timeLabel}, {weekdayLong(day)} {dayMonth(day, true)}
                </p>
                <p className="ci-preview__meta">
                  {d.kind === 'online' ? <IconLink size={12} /> : <IconBuilding size={12} />}
                  {d.kind === 'online' ? (d.autoLink ? `Link ${MEETING_PLATFORM_LABEL[d.platform]} gửi kèm` : d.meetingUrl || '…') : d.location || '…'}
                </p>
                <p className="ci-preview__meta">Liên hệ: {host} · 1900 66 99</p>
                <span className="ci-preview__actions">
                  <span className="ci-preview__btn ci-preview__btn--primary">Xác nhận tham gia</span>
                  <span className="ci-preview__btn">Xin đổi giờ</span>
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Remind({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <span className="ci-remind">
      <span className="ci-person__text">
        <b>{title}</b>
        <small>{desc}</small>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={title} className={cx('emp-switch', on && 'emp-switch--on')} onClick={onToggle}>
        <span className="emp-switch__knob" />
      </button>
    </span>
  );
}
