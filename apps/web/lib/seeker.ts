import { PREFECTURES_BY_REGION, REGION_LABEL, REGIONS, type SeekerExperience, type SeekerProfile } from '@viecpro/shared';

/** "2020-03" → "03/2020", "2017" → "2017" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return m ? `${m}/${y}` : y!;
}

/** Thời gian làm: "3 năm 3 tháng" (chỉ khi có tháng) */
export function durationLabel(from: string, to: string | null, now = new Date()): string {
  if (!from.includes('-') || (to && !to.includes('-'))) return '';
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to ? (to.split('-').map(Number) as [number, number]) : [now.getFullYear(), now.getMonth() + 1];
  const months = (ty - fy) * 12 + (tm - fm);
  if (months <= 0) return '';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} năm`, m && `${m} tháng`].filter(Boolean).join(' ');
}

export function experienceRange(e: SeekerExperience): string {
  const range = `${monthLabel(e.from)} – ${e.to ? monthLabel(e.to) : 'nay'}`;
  const d = e.kind === 'work' ? durationLabel(e.from, e.to) : '';
  return d ? `${range} · ${d}` : range;
}

/** Tỉnh quan tâm → gọn theo vùng: chọn ≥ 3 tỉnh của một vùng thì hiện tên vùng ("Kanto, Hokkaido") */
export function prefsSummary(prefs: string[]): string {
  return REGIONS.flatMap((r) => {
    const picked = PREFECTURES_BY_REGION[r].filter((p) => prefs.includes(p));
    if (!picked.length) return [];
    return picked.length >= 3 ? [REGION_LABEL[r]] : picked;
  }).join(', ');
}

/** Mức hồ sơ theo % hoàn thiện */
export function completionLevel(pct: number): string {
  return pct >= 85 ? 'Hồ sơ tốt' : pct >= 60 ? 'Hồ sơ khá' : 'Hồ sơ cơ bản';
}

/** Khối nào của hồ sơ đã đủ (chấm xanh trên thanh mục) */
export function sectionDone(p: SeekerProfile) {
  return {
    personal: !!(p.birthYear && p.gender && p.hometown && p.heightCm && p.weightKg),
    wishes: !!(p.programs.length && p.industries.length && p.prefs.length),
    experience: p.experiences.length > 0,
    skills: !!p.jlpt && p.skills.length > 0,
    documents: p.documents.every((d) => d.status === 'verified' || d.status === 'uploaded'),
    video: !!p.videoUrl,
  };
}

export type ProfileSectionKey = keyof ReturnType<typeof sectionDone>;

/** Yêu cầu của đơn: "Nữ 18–30 · N4" */
export function requirementText(j: { gender: 'nam' | 'nu' | 'both'; birthYearFrom: number; birthYearTo: number; jlptRequired?: string | null }, year = new Date().getFullYear()): string {
  const g = j.gender === 'both' ? 'Nam/Nữ' : j.gender === 'nam' ? 'Nam' : 'Nữ';
  return `${g} ${year - j.birthYearTo}–${year - j.birthYearFrom}${j.jlptRequired ? ` · ${j.jlptRequired}` : ''}`;
}

/** "hôm nay", "hôm qua", "5 ngày trước", "2 tuần trước", "3 tháng trước" */
export function daysAgo(iso: string, now = Date.now()): string {
  const start = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const d = Math.round((start(now) - start(Date.parse(iso))) / 86400_000);
  if (d <= 0) return 'hôm nay';
  if (d === 1) return 'hôm qua';
  if (d < 7) return `${d} ngày trước`;
  if (d < 30) return `${Math.floor(d / 7)} tuần trước`;
  return `${Math.floor(d / 30)} tháng trước`;
}

export const yen = (n: number) => `${n.toLocaleString('vi-VN')} ¥`;

/** "Còn 23 giờ 20 phút" / "Còn 2 ngày 3 giờ" tới thời điểm `iso` */
export function countdown(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'Đang diễn ra';
  const min = Math.floor(ms / 60_000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return d ? `Còn ${d} ngày ${h} giờ` : h ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút`;
}

/** Tệp lịch .ics (Google / Apple / Outlook đều mở được) cho nút "Thêm vào lịch" */
export function icsFile(e: { uid: string; title: string; start: string; end: string; location?: string | null; description?: string }): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t: string) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//viecpro//vi',
    'BEGIN:VEVENT',
    `UID:${e.uid}@viecpro.vn`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.location ? `LOCATION:${esc(e.location)}` : '',
    e.description ? `DESCRIPTION:${esc(e.description)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Sắp tới giờ phỏng vấn',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** Tải một chuỗi thành tệp */
export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
