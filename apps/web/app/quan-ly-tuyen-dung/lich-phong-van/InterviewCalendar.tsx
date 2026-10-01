'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { INTERVIEW_KIND_LABEL, INTERVIEW_KINDS, MEETING_PLATFORM_LABEL, type EmployerInterviewItem, type EmployerInterviewWeek, type InterviewKind, type MeetingPlatform } from '@viecpro/shared';
import { useEmployerAccount } from '@/components/employer/EmployerAccountProvider';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { IconCalendar, IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconClose, IconList, IconPin, IconPlus, IconUser, IconUserOff, IconVideo } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import { dayMonth, hourMinute, initialOf, telHref, weekdayLong, weekdayShort } from '@/lib/employer';
import { cx } from '@/lib/format';

const DAY = 86400_000;
/** Lưới giờ: 8:00 → 19:00, 64px mỗi giờ */
const GRID_START = 8;
const GRID_END = 19;
const HOUR_PX = 64;

type Phase = 'past' | 'live' | 'upcoming';

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const pad = (n: number) => String(n).padStart(2, '0');

function phaseOf(i: EmployerInterviewItem, now = Date.now()): Phase {
  if (i.status !== 'scheduled' || new Date(i.endAt).getTime() <= now) return 'past';
  return new Date(i.startAt).getTime() <= now ? 'live' : 'upcoming';
}
const isPending = (i: EmployerInterviewItem) => phaseOf(i) === 'upcoming' && i.attendees.some((a) => a.status === 'pending');
const titleOf = (i: EmployerInterviewItem) => (i.attendees.length > 1 ? (i.kind === 'skill_test' ? 'Thi tay nghề nhóm' : `Nhóm ${i.attendees.length} ứng viên`) : (i.attendees[0]?.fullName ?? 'Chưa có ứng viên'));
const minutes = (i: EmployerInterviewItem) => Math.round((new Date(i.endAt).getTime() - new Date(i.startAt).getTime()) / 60_000);

/** Lịch phỏng vấn (design 14) */
export default function InterviewCalendar() {
  const { refresh: refreshAccount } = useEmployerAccount();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [view, setView] = useState<'week' | 'list'>('week');
  const [data, setData] = useState<EmployerInterviewWeek | null>(null);
  const [kinds, setKinds] = useState<Set<InterviewKind>>(new Set(INTERVIEW_KINDS));
  const [person, setPerson] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Mở thẳng một lịch từ dashboard (?id=…)
  useEffect(() => {
    setSelectedId(new URLSearchParams(window.location.search).get('id'));
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    const p = new URLSearchParams({ from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() });
    apiRequest<EmployerInterviewWeek>(`/employer/interviews?${p.toString()}`)
      .then((d) => {
        if (!active) return;
        setData(d);
        setError('');
      })
      .catch((e: unknown) => active && setError(apiMessage(e, 'Không tải được lịch phỏng vấn.')));
    return () => {
      active = false;
    };
  }, [weekStart, reloadKey]);

  const reload = useCallback(async () => {
    setReloadKey((k) => k + 1);
    await refreshAccount();
  }, [refreshAccount]);

  const items = useMemo(
    () => (data?.items ?? []).filter((i) => kinds.has(i.kind) && (!person || i.interviewers.some((r) => r.id === person))),
    [data, kinds, person],
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selected = items.find((i) => i.id === selectedId) ?? data?.items.find((i) => i.id === selectedId) ?? null;
  const stats = data?.stats;
  const noShowDelta = stats && stats.noShowRate !== null && stats.noShowRatePrev !== null ? stats.noShowRate - stats.noShowRatePrev : null;
  const prevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  const toggleKind = (k: InterviewKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="cal-page">
      <div className="emp-page-head">
        <span className="emp-page-head__titles">
          <nav className="emp-crumbs" aria-label="Breadcrumb">
            <Link href={EMPLOYER_BASE}>Tổng quan</Link>
            <span className="emp-crumbs__sep">/</span>
            <span className="emp-crumbs__current">Lịch phỏng vấn</span>
          </nav>
          <h1 className="emp-page-head__title">Lịch phỏng vấn</h1>
        </span>
        <span className="emp-page-head__actions">
          <span className="cal-range">
            <button type="button" className="cal-range__btn" aria-label="Tuần trước" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <IconChevronLeft size={16} className="icon--w22" />
            </button>
            <span className="cal-range__label">
              {dayMonth(weekStart, true)} – {dayMonth(addDays(weekStart, 6), true)}/{addDays(weekStart, 6).getFullYear()}
            </span>
            <button type="button" className="cal-range__btn" aria-label="Tuần sau" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <IconChevronRight size={16} className="icon--w22" />
            </button>
          </span>
          <button type="button" className="emp-btn cal-head-btn" onClick={() => setWeekStart(mondayOf(new Date()))}>
            Hôm nay
          </button>
          <span className="cal-views" role="radiogroup" aria-label="Kiểu xem">
            <button type="button" role="radio" aria-checked={view === 'week'} className={cx('cal-views__btn', view === 'week' && 'cal-views__btn--active')} onClick={() => setView('week')}>
              <IconCalendar size={15} />
              Tuần
            </button>
            <button type="button" role="radio" aria-checked={view === 'list'} className={cx('cal-views__btn', view === 'list' && 'cal-views__btn--active')} onClick={() => setView('list')}>
              <IconList size={15} />
              Danh sách
            </button>
          </span>
          <Link href={`${EMPLOYER_BASE}/lich-phong-van/tao`} className="emp-btn emp-btn--primary cal-head-btn">
            <IconPlus size={17} className="icon--w24" />
            Tạo lịch hẹn
          </Link>
        </span>
      </div>

      <div className="cal-stats">
        <StatCard tone="blue" icon={<IconCalendar size={20} className="icon--w2" />} label="Lịch hẹn tuần này" value={stats?.total ?? 0} note={`${stats?.remainingToday ?? 0} còn lại hôm nay`} />
        <StatCard tone="green" icon={<IconCheck size={20} className="icon--w2" />} label="Đã xác nhận" value={stats?.confirmed ?? 0} note={stats?.total ? `${Math.round((stats.confirmed / stats.total) * 100)}%` : '0%'} noteTone="good" />
        <StatCard tone="orange" icon={<IconClock size={20} className="icon--w2" />} label="Chờ ứng viên xác nhận" value={stats?.pending ?? 0} note={stats?.pending ? 'Cần nhắc lại' : 'Đã đủ xác nhận'} noteTone={stats?.pending ? 'warn' : 'good'} />
        <StatCard
          tone="red"
          icon={<IconUserOff size={20} className="icon--w2" />}
          label="Tỉ lệ vắng mặt"
          value={stats?.noShowRate === null || !stats ? '—' : `${stats.noShowRate}%`}
          note={noShowDelta === null ? (stats?.noShowRatePrev !== null && stats ? `Tháng ${prevMonth.getMonth() + 1}: ${stats.noShowRatePrev}%` : 'Chưa có số liệu') : `${noShowDelta <= 0 ? '−' : '+'}${Math.abs(noShowDelta)}% so với tháng ${prevMonth.getMonth() + 1}`}
          noteTone={noShowDelta !== null && noShowDelta > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="cal-layout">
        <div className="cal-side">
          <MiniMonth weekStart={weekStart} onPick={(d) => setWeekStart(mondayOf(d))} />

          <div className="emp-card cal-box">
            <b className="cal-box__title">Loại lịch hẹn</b>
            {INTERVIEW_KINDS.map((k) => (
              <button key={k} type="button" role="checkbox" aria-checked={kinds.has(k)} className="cal-filter" onClick={() => toggleKind(k)}>
                <span className={cx('cal-filter__box', `cal-filter__box--${k}`, kinds.has(k) && 'cal-filter__box--on')}>
                  <IconCheck size={11} className="icon--w4" />
                </span>
                <span className="cal-filter__label">{INTERVIEW_KIND_LABEL[k]}</span>
                <span className="cal-filter__count">{data?.kindCounts[k] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="emp-card cal-box">
            <b className="cal-box__title">Người phỏng vấn</b>
            {(data?.interviewers ?? []).map((r) => (
              <button key={r.id} type="button" aria-pressed={person === r.id} className={cx('cal-person', person === r.id && 'cal-person--active')} onClick={() => setPerson((p) => (p === r.id ? null : r.id))}>
                {r.photoUrl ? <img className="cal-person__avatar" src={r.photoUrl} alt="" /> : <span className="cal-person__avatar cal-person__avatar--text">{initialOf(r.name)}</span>}
                <span className="cal-person__text">
                  <span className="cal-person__name">{r.name}</span>
                  <span className="cal-person__title">{r.title}</span>
                </span>
                <span className="cal-person__count">{r.count} lịch</span>
              </button>
            ))}
            {data && !data.interviewers.length && <p className="emp-empty cal-box__empty">Tuần này chưa có lịch.</p>}
          </div>

          <ReminderCard />
        </div>

        <div className="cal-main">
          {error && (
            <p className="emp-error" role="alert">
              {error}
            </p>
          )}
          {view === 'week' ? (
            <WeekGrid days={days} items={items} now={now} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          ) : (
            <ListView days={days} items={items} now={now} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          )}
          {selected && <Popover key={selected.id} item={selected} now={now} anchor={view === 'week' ? anchorOf(selected, days) : null} onClose={() => setSelectedId(null)} onChanged={reload} />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ tone, icon, label, value, note, noteTone }: { tone: string; icon: ReactNode; label: string; value: number | string; note: string; noteTone?: 'good' | 'warn' }) {
  return (
    <div className="cal-stat">
      <span className={cx('cal-stat__icon', `cal-stat__icon--${tone}`)}>{icon}</span>
      <span className="cal-stat__text">
        <span className="cal-stat__label">{label}</span>
        <span className="cal-stat__row">
          <span className="cal-stat__value">{value}</span>
          <span className={cx('cal-stat__note', noteTone && `cal-stat__note--${noteTone}`)}>{note}</span>
        </span>
      </span>
    </div>
  );
}

/* ---------- Lịch tháng nhỏ ---------- */
function MiniMonth({ weekStart, onPick }: { weekStart: Date; onPick: (d: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
  const [busyDays, setBusyDays] = useState<Set<string>>(new Set());

  useEffect(() => setMonth(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)), [weekStart]);

  // Ngày có lịch hẹn trong 6 tuần hiển thị
  const gridStart = mondayOf(month);
  useEffect(() => {
    let active = true;
    const from = mondayOf(month);
    const p = new URLSearchParams({ from: from.toISOString(), to: addDays(from, 42).toISOString() });
    apiRequest<EmployerInterviewWeek>(`/employer/interviews?${p.toString()}`)
      .then((d) => active && setBusyDays(new Set(d.items.map((i) => new Date(i.startAt).toDateString()))))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [month]);

  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekEnd = addDays(weekStart, 7);
  const today = new Date();
  return (
    <div className="emp-card cal-box cal-month">
      <span className="cal-month__head">
        <b>
          Tháng {month.getMonth() + 1}, {month.getFullYear()}
        </b>
        <span className="cal-month__nav">
          <button type="button" aria-label="Tháng trước" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <IconChevronLeft size={16} className="icon--w22" />
          </button>
          <button type="button" aria-label="Tháng sau" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <IconChevronRight size={16} className="icon--w22" />
          </button>
        </span>
      </span>
      <div className="cal-month__grid">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <span key={d} className="cal-month__dow">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const inWeek = d >= weekStart && d < weekEnd;
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={cx('cal-month__day', inWeek && 'cal-month__day--week', d.getMonth() !== month.getMonth() && 'cal-month__day--muted', sameDay(d, weekStart) && inWeek && 'cal-month__day--first', sameDay(d, addDays(weekStart, 6)) && 'cal-month__day--last')}
              onClick={() => onPick(d)}
              aria-label={`${weekdayLong(d)}, ${dayMonth(d, true)}`}
            >
              <span className={cx('cal-month__num', sameDay(d, today) && 'cal-month__num--today')}>{d.getDate()}</span>
              <span className={cx('cal-month__dot', busyDays.has(d.toDateString()) && 'cal-month__dot--on')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Nhắc lịch Zalo ---------- */
function ReminderCard() {
  // Chưa có API: cài đặt nhắc lịch tự động cho cả tài khoản (mỗi lịch hẹn đã lưu tuỳ chọn nhắc 24h / 2h riêng)
  const [on, setOn] = useState(true);
  return (
    <div className="cal-remind">
      <span className="cal-remind__head">
        <b>Nhắc lịch qua Zalo</b>
        <button type="button" role="switch" aria-checked={on} aria-label="Nhắc lịch qua Zalo" className={cx('emp-switch', on && 'emp-switch--on')} onClick={() => setOn((v) => !v)}>
          <span className="emp-switch__knob" />
        </button>
      </span>
      <span className="cal-remind__text">Tự gửi tin nhắc trước 24 giờ và 2 giờ. Giúp giảm 60% ứng viên vắng mặt.</span>
    </div>
  );
}

/* ---------- Lưới tuần ---------- */
interface Placed {
  item: EmployerInterviewItem;
  lane: number;
  lanes: number;
}

/** Xếp các lịch chồng giờ trong cùng ngày thành nhiều làn */
function placeDay(list: EmployerInterviewItem[]): Placed[] {
  const sorted = [...list].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const out: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => out.push({ ...g, lanes }));
    group = [];
  };
  for (const item of sorted) {
    const start = new Date(item.startAt).getTime();
    if (group.length && start >= groupEnd) flush();
    const used = new Set(group.filter((g) => new Date(g.item.endAt).getTime() > start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, new Date(item.endAt).getTime());
  }
  if (group.length) flush();
  return out;
}

function WeekGrid({ days, items, now, selectedId, onSelect }: { days: Date[]; items: EmployerInterviewItem[]; now: number; selectedId: string | null; onSelect: (id: string) => void }) {
  const hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
  const nowDate = new Date(now);
  const nowTop = ((nowDate.getHours() + nowDate.getMinutes() / 60 - GRID_START) * HOUR_PX);
  return (
    <div className="emp-card cal-week">
      <div className="cal-week__scroll">
        <div className="cal-week__head">
          <span className="cal-week__tz">GMT+7</span>
          {days.map((d) => {
            const count = items.filter((i) => sameDay(new Date(i.startAt), d)).length;
            const today = sameDay(d, nowDate);
            const past = d.getTime() + DAY <= now;
            return (
              <span key={d.toISOString()} className={cx('cal-week__day', today && 'cal-week__day--today', past && 'cal-week__day--past')}>
                <span className="cal-week__dow">{weekdayShort(d)}</span>
                <span className="cal-week__date">{d.getDate()}</span>
                <span className="cal-week__count">{count ? `${count} lịch` : '—'}</span>
              </span>
            );
          })}
        </div>
        <div className="cal-week__body">
          <span className="cal-week__hours" aria-hidden="true">
            {hours.slice(1).map((h) => (
              <span key={h} className="cal-week__hour" style={{ top: `${(h - GRID_START) * HOUR_PX - 7}px` }}>
                {pad(h)}:00
              </span>
            ))}
          </span>
          {days.map((d) => {
            const today = sameDay(d, nowDate);
            const placed = placeDay(items.filter((i) => sameDay(new Date(i.startAt), d)));
            return (
              <div key={d.toISOString()} className={cx('cal-week__col', today && 'cal-week__col--today')}>
                {today && nowTop >= 0 && nowTop <= (GRID_END - GRID_START) * HOUR_PX && <span className="cal-week__now" style={{ top: `${nowTop}px` }} aria-hidden="true" />}
                {placed.map(({ item, lane, lanes }) => (
                  <EventBlock key={item.id} item={item} lane={lane} lanes={lanes} now={now} selected={item.id === selectedId} onSelect={() => onSelect(item.id)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventBlock({ item, lane, lanes, now, selected, onSelect }: { item: EmployerInterviewItem; lane: number; lanes: number; now: number; selected: boolean; onSelect: () => void }) {
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  const top = Math.max(0, (start.getHours() + start.getMinutes() / 60 - GRID_START) * HOUR_PX) + 2;
  const height = Math.max(28, ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX - 4);
  const phase = phaseOf(item, now);
  const pending = isPending(item);
  const noShow = item.attendees.length > 0 && item.attendees.every((a) => a.status === 'no_show');
  const sub = phase === 'live' ? '● Đang diễn ra' : noShow ? 'Vắng mặt · chưa phản hồi' : pending ? `Chờ xác nhận · ${item.attendees[0]?.jobShortTitle ?? ''}` : (item.attendees[0]?.jobShortTitle ?? '');
  const style: CSSProperties = { top: `${top}px`, height: `${height}px`, left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)` };
  return (
    <button
      type="button"
      className={cx('cal-event', `cal-event--${item.kind}`, phase === 'past' && 'cal-event--past', pending && 'cal-event--pending', selected && 'cal-event--selected')}
      style={style}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="cal-event__time">
        {hourMinute(start)} – {hourMinute(end)}
      </span>
      <span className="cal-event__title">{titleOf(item)}</span>
      <span className={cx('cal-event__sub', phase === 'live' && 'cal-event__sub--live', noShow && 'cal-event__sub--late')}>{sub}</span>
    </button>
  );
}

/* ---------- Danh sách ---------- */
function ListView({ days, items, now, selectedId, onSelect }: { days: Date[]; items: EmployerInterviewItem[]; now: number; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="emp-card cal-list">
      {days.map((d) => {
        const list = items.filter((i) => sameDay(new Date(i.startAt), d));
        if (!list.length) return null;
        return (
          <section key={d.toISOString()} className="cal-list__day">
            <h2 className="cal-list__date">
              {weekdayLong(d)}, {dayMonth(d, true)}
              <span>{list.length} lịch</span>
            </h2>
            {list.map((i) => (
              <button key={i.id} type="button" className={cx('cal-list__row', i.id === selectedId && 'cal-list__row--active')} onClick={() => onSelect(i.id)}>
                <span className="cal-list__time">
                  {hourMinute(i.startAt)}
                  <small>{minutes(i)} phút</small>
                </span>
                <span className={cx('cal-list__bar', `cal-list__bar--${i.kind}`)} />
                <span className="cal-list__text">
                  <b>{titleOf(i)}</b>
                  <span>
                    {INTERVIEW_KIND_LABEL[i.kind]} · {i.attendees[0]?.jobShortTitle ?? ''} · {i.interviewers.map((r) => r.name).join(', ')}
                  </span>
                </span>
                <span className={cx('cal-list__tag', isPending(i) && 'cal-list__tag--pending', phaseOf(i, now) === 'past' && 'cal-list__tag--past')}>
                  {phaseOf(i, now) === 'live' ? 'Đang diễn ra' : phaseOf(i, now) === 'past' ? 'Đã kết thúc' : isPending(i) ? 'Chờ xác nhận' : 'Đã xác nhận'}
                </span>
              </button>
            ))}
          </section>
        );
      })}
      {!items.length && <p className="emp-empty">Tuần này chưa có lịch hẹn.</p>}
    </div>
  );
}

/* ---------- Popup chi tiết ---------- */
/** Chiều cao phần đầu lưới tuần (thứ / ngày / số lịch) */
const WEEK_HEAD_PX = 92;

/** Vị trí popup cạnh ô lịch: ngày đầu tuần → bên phải ô, cuối tuần → bên trái ô */
function anchorOf(item: EmployerInterviewItem, days: Date[]): CSSProperties | null {
  const start = new Date(item.startAt);
  const day = days.findIndex((d) => sameDay(d, start));
  // Mobile: popup là ngăn dưới màn hình, không bám theo ô
  if (day < 0 || window.matchMedia('(max-width: 767px)').matches) return null;
  const top = WEEK_HEAD_PX + Math.max(0, (start.getHours() + start.getMinutes() / 60 - GRID_START) * HOUR_PX) - 40;
  const col = `(100% - 56px) / 7`;
  return day <= 3
    ? { top: `${Math.max(8, top)}px`, left: `calc(56px + ${col} * ${day + 1} + 8px)`, right: 'auto' }
    : { top: `${Math.max(8, top)}px`, right: `calc(${col} * ${7 - day} + 8px)`, left: 'auto' };
}

function Popover({ item, now, anchor, onClose, onChanged }: { item: EmployerInterviewItem; now: number; anchor: CSSProperties | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<'view' | 'move' | 'result'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  const phase = phaseOf(item, now);
  const pending = isPending(item);

  // Dời lịch
  const [date, setDate] = useState(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
  const [time, setTime] = useState(hourMinute(start));
  // Ghi kết quả
  const [present, setPresent] = useState<Record<string, boolean>>(() => Object.fromEntries(item.attendees.map((a) => [a.applicationId, a.status !== 'no_show'])));
  const [result, setResult] = useState(item.result ?? '');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setMode('view');
      await onChanged();
    } catch (e) {
      setError(apiMessage(e, 'Thao tác chưa thành công.'));
    } finally {
      setBusy(false);
    }
  };

  const move = () =>
    run(() => {
      const startAt = new Date(`${date}T${time}:00`);
      const endAt = new Date(startAt.getTime() + minutes(item) * 60_000);
      return apiRequest(`/employer/interviews/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ startAt: startAt.toISOString(), endAt: endAt.toISOString() }) });
    });
  const saveResult = () =>
    run(() =>
      apiRequest(`/employer/interviews/${encodeURIComponent(item.id)}/result`, {
        method: 'POST',
        body: JSON.stringify({ attendees: item.attendees.map((a) => ({ applicationId: a.applicationId, status: present[a.applicationId] ? 'attended' : 'no_show' })), result: result.trim() || undefined }),
      }),
    );
  const cancel = () => {
    if (!window.confirm('Huỷ lịch hẹn này? Ứng viên sẽ nhận được thông báo.')) return;
    void run(async () => {
      await apiRequest(`/employer/interviews/${encodeURIComponent(item.id)}/cancel`, { method: 'POST' });
      onClose();
    });
  };

  const notice =
    phase === 'live'
      ? 'Buổi hẹn đang diễn ra.'
      : pending
        ? 'Ứng viên chưa xác nhận tham gia – nên gọi nhắc trước buổi hẹn.'
        : item.attendees.every((a) => a.status === 'no_show') && item.attendees.length
          ? 'Ứng viên vắng mặt, chưa phản hồi.'
          : null;
  const first = item.attendees[0];

  return (
    <div className={cx('cal-pop', `cal-pop--${item.kind}`, anchor && 'cal-pop--anchored')} style={anchor ?? undefined} role="dialog" aria-label={`Lịch hẹn ${titleOf(item)}`}>
      <div className="cal-pop__head">
        <span className="cal-pop__badges">
          <span className="cal-pop__badge">{INTERVIEW_KIND_LABEL[item.kind]}</span>
          <span className={cx('cal-pop__badge', `cal-pop__badge--${phase === 'live' ? 'live' : pending ? 'pending' : phase}`)}>
            {phase === 'live' ? 'Đang diễn ra' : phase === 'past' ? (item.status === 'done' ? 'Đã có kết quả' : 'Đã kết thúc') : pending ? 'Chờ xác nhận' : 'Đã xác nhận'}
          </span>
        </span>
        <button type="button" className="cal-pop__close" aria-label="Đóng" onClick={onClose}>
          <IconClose size={14} className="icon--w24" />
        </button>
      </div>
      <div className="cal-pop__body">
        <span className="cal-pop__titles">
          <span className="cal-pop__title">{titleOf(item)}</span>
          <span className="cal-pop__sub">{item.attendees.length > 1 ? item.attendees.map((a) => a.fullName).join(', ') : (first?.jobShortTitle ?? '')}</span>
        </span>
        <span className="cal-pop__line">
          <IconClock size={16} />
          <span>
            <b>
              {weekdayLong(start)}, {dayMonth(start, true)}
            </b>
            <small>
              {hourMinute(start)} – {hourMinute(end)} · {minutes(item)} phút
            </small>
          </span>
        </span>
        <span className="cal-pop__line">
          {item.kind === 'online' ? <IconVideo size={16} /> : <IconPin size={16} />}
          <span>
            <b>{item.kind === 'online' ? (MEETING_PLATFORM_LABEL[item.platform as MeetingPlatform] ?? 'Online') : (item.location ?? 'Chưa có địa điểm')}</b>
            {item.kind === 'online' && item.meetingUrl && <small className="cal-pop__link">{item.channels.length ? `Link đã gửi qua ${item.channels.map((c) => (c === 'sms' ? 'SMS' : c === 'zalo' ? 'Zalo' : 'email')).join(' & ')}` : 'Chưa gửi link cho ứng viên'}</small>}
          </span>
        </span>
        <span className="cal-pop__line">
          <IconUser size={16} />
          <span>
            <b>{item.interviewers.map((r) => r.name).join(', ')}</b>
            <small>{item.partnerName ? `+ ${item.partnerName}` : (item.interviewers[0]?.title ?? '')}</small>
          </span>
        </span>
        {notice && <span className={cx('cal-pop__notice', pending && 'cal-pop__notice--warn')}>{notice}</span>}
        {item.result && <span className="cal-pop__result">Kết quả: {item.result}</span>}

        {mode === 'move' && (
          <div className="cal-pop__form">
            <label className="cal-pop__field">
              Ngày
              <input type="date" className="field-input cal-pop__input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="cal-pop__field">
              Giờ bắt đầu
              <input type="time" className="field-input cal-pop__input" value={time} step={900} onChange={(e) => setTime(e.target.value)} />
            </label>
            <span className="cal-pop__actions cal-pop__actions--full">
              <button type="button" className="emp-btn emp-btn--md" onClick={() => setMode('view')}>
                Huỷ
              </button>
              <button type="button" className="emp-btn emp-btn--md emp-btn--primary" disabled={busy} onClick={() => void move()}>
                {busy ? 'Đang lưu…' : 'Lưu lịch mới'}
              </button>
            </span>
          </div>
        )}

        {mode === 'result' && (
          <div className="cal-pop__form cal-pop__form--col">
            {item.attendees.map((a) => (
              <button key={a.applicationId} type="button" role="checkbox" aria-checked={present[a.applicationId]} className="cal-filter" onClick={() => setPresent((p) => ({ ...p, [a.applicationId]: !p[a.applicationId] }))}>
                <span className={cx('cal-filter__box cal-filter__box--online', present[a.applicationId] && 'cal-filter__box--on')}>
                  <IconCheck size={11} className="icon--w4" />
                </span>
                <span className="cal-filter__label">{a.fullName}</span>
                <span className="cal-filter__count">{present[a.applicationId] ? 'Có mặt' : 'Vắng'}</span>
              </button>
            ))}
            <textarea className="cal-pop__note" value={result} maxLength={1000} placeholder="Nhận xét buổi phỏng vấn…" aria-label="Nhận xét" onChange={(e) => setResult(e.target.value)} />
            <span className="cal-pop__actions cal-pop__actions--full">
              <button type="button" className="emp-btn emp-btn--md" onClick={() => setMode('view')}>
                Huỷ
              </button>
              <button type="button" className="emp-btn emp-btn--md emp-btn--primary" disabled={busy} onClick={() => void saveResult()}>
                {busy ? 'Đang lưu…' : 'Lưu kết quả'}
              </button>
            </span>
          </div>
        )}

        {mode === 'view' && item.status !== 'cancelled' && (
          <div className="cal-pop__actions">
            {item.kind === 'online' && item.meetingUrl && phase !== 'past' ? (
              <a className="emp-btn emp-btn--primary cal-pop__main" href={item.meetingUrl} target="_blank" rel="noreferrer">
                Vào phòng phỏng vấn
              </a>
            ) : first ? (
              <a className="emp-btn emp-btn--primary cal-pop__main" href={telHref(first.phone)}>
                Gọi {item.attendees.length > 1 ? 'ứng viên đầu tiên' : first.fullName}
              </a>
            ) : null}
            <button type="button" className="emp-btn emp-btn--md" disabled={item.status !== 'scheduled'} onClick={() => setMode('move')}>
              Dời lịch
            </button>
            <button type="button" className="emp-btn emp-btn--md" disabled={phase === 'upcoming'} title={phase === 'upcoming' ? 'Ghi kết quả sau khi buổi hẹn bắt đầu' : undefined} onClick={() => setMode('result')}>
              Ghi kết quả
            </button>
            {item.status === 'scheduled' && phase === 'upcoming' && (
              <button type="button" className="emp-link-btn cal-pop__cancel" onClick={cancel}>
                Huỷ lịch hẹn
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="emp-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
