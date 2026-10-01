import { ageOf, jobShortTitle, MEETING_PLATFORM_LABEL, type ApplicantBrief, type Gender, type InterviewBrief, type InterviewKind, type MeetingPlatform } from '@viecpro/shared';

const DAY = 86400_000;

/** Hồ sơ chưa liên hệ quá 24 giờ */
export function isOverdue(a: { status: string; createdAt: Date }, now = Date.now()): boolean {
  return a.status === 'submitted' && now - a.createdAt.getTime() > DAY;
}

type BriefRow = {
  id: string;
  fullName: string;
  gender: Gender;
  birthYear: number;
  hometown: string | null;
  address: string | null;
  matchScore: number | null;
  phone: string;
  status: string;
  createdAt: Date;
  job: { position: string | null; industry: string; pref: string };
};

export function applicantBrief(a: BriefRow): ApplicantBrief {
  return {
    id: a.id,
    fullName: a.fullName,
    gender: a.gender,
    age: ageOf(a.birthYear),
    hometown: a.hometown ?? a.address,
    jobShortTitle: jobShortTitle(a.job),
    matchScore: a.matchScore,
    phone: a.phone,
    createdAt: a.createdAt.toISOString(),
    overdue: isOverdue(a),
  };
}

/** select dùng cho applicantBrief */
export const applicantBriefSelect = {
  id: true,
  fullName: true,
  gender: true,
  birthYear: true,
  hometown: true,
  address: true,
  matchScore: true,
  phone: true,
  status: true,
  createdAt: true,
  job: { select: { position: true, industry: true, pref: true } },
} as const;

type InterviewRow = {
  id: string;
  kind: InterviewKind;
  startAt: Date;
  endAt: Date;
  platform: string | null;
  location: string | null;
  attendees: Array<{ application: { fullName: string; job: { position: string | null; industry: string; pref: string } } }>;
};

/** Lịch hẹn rút gọn: 1 ứng viên → tên; nhiều ứng viên → "Nhóm N ứng viên" */
export function interviewBrief(i: InterviewRow, now = Date.now()): InterviewBrief {
  const first = i.attendees[0]?.application;
  const where = i.kind === 'online' ? (MEETING_PLATFORM_LABEL[i.platform as MeetingPlatform] ?? 'Online') : (i.location ?? (i.kind === 'skill_test' ? 'Xưởng test' : 'Trực tiếp'));
  const label = i.kind === 'skill_test' ? 'Thi tay nghề' : first ? jobShortTitle(first.job) : 'Phỏng vấn';
  return {
    id: i.id,
    kind: i.kind,
    startAt: i.startAt.toISOString(),
    endAt: i.endAt.toISOString(),
    title: i.attendees.length > 1 ? `Nhóm ${i.attendees.length} ứng viên` : (first?.fullName ?? 'Chưa có ứng viên'),
    subtitle: i.kind === 'skill_test' && first ? `${label} đơn ${first.job.pref} · ${where}` : `${label} · ${where}`,
    phase: now >= i.endAt.getTime() ? 'done' : now >= i.startAt.getTime() ? 'live' : 'upcoming',
  };
}

export const interviewBriefInclude = {
  attendees: { select: { application: { select: { fullName: true, job: { select: { position: true, industry: true, pref: true } } } } } },
} as const;
