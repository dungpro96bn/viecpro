import { MEETING_PLATFORM_LABEL, type ApplicationItem, type MeetingPlatform } from '@viecpro/shared';
import { dayMonth, hourMinute, weekdayLong } from '@/lib/employer';
import { downloadText, icsFile } from '@/lib/seeker';

/** "Online qua Zoom · Công ty · Tên đơn" */
export function interviewPlace(a: ApplicationItem): string {
  const iv = a.interview!;
  const where = iv.kind === 'online' ? `Online qua ${MEETING_PLATFORM_LABEL[iv.platform as MeetingPlatform] ?? 'video'}` : (iv.location ?? 'Trực tiếp');
  return [where, iv.employerName, a.job.title].filter(Boolean).join(' · ');
}

/** "Thứ Năm, 01/10 · 10:00 – 11:00" */
export const longWhen = (startAt: string, endAt: string) => `${weekdayLong(new Date(startAt))}, ${dayMonth(startAt, true)} · ${hourMinute(startAt)} – ${hourMinute(endAt)}`;

/** Tải tệp .ics để thêm buổi phỏng vấn vào lịch điện thoại / Google Calendar */
export function addToCalendar(a: ApplicationItem) {
  const iv = a.interview!;
  downloadText(
    `phong-van-${dayMonth(iv.startAt, true).replace('/', '-')}.ics`,
    icsFile({
      uid: iv.id,
      title: `Phỏng vấn: ${a.job.title}`,
      start: iv.startAt,
      end: iv.endAt,
      location: iv.kind === 'online' ? MEETING_PLATFORM_LABEL[iv.platform as MeetingPlatform] : iv.location,
      description: interviewPlace(a),
    }),
    'text/calendar;charset=utf-8',
  );
}
