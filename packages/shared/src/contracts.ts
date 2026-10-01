/**
 * Kiểu dữ liệu API trả về (response). Web và mobile dùng chung để gọi API có kiểu.
 * Ngày giờ trả về dạng chuỗi ISO 8601; URL ảnh luôn là URL tuyệt đối.
 */
import type {
  ApplicantStage,
  ApplicationSource,
  ApplicationStatus,
  AttendeeStatus,
  BadgeKind,
  DashboardRange,
  EmployerJobTab,
  EmployerRange,
  InterviewKind,
  InterviewStatus,
  JobVisibility,
  JlptLevel,
  MaritalStatus,
  SeekerDocumentKey,
  SeekerDocumentStatus,
  SeekerApplicationStep,
  SeekerApplicationTab,
  Gender,
  Industry,
  JobGender,
  JobStatus,
  JobTag,
  Platform,
  Program,
  RegionKey,
  Role,
} from './enums.js';
import type { AdminPermission } from './admin.js';
import type { JobDetailContent, JobPosting } from './schemas/jobs.js';

/** Danh sách có phân trang */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/** Lỗi API – app dựa vào `code` để xử lý, `message` hiển thị cho người dùng */
export interface ApiError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  /** Lỗi theo từng trường (validate form) */
  fields?: Record<string, string>;
}

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'WRONG_ROLE',
  'PHONE_NOT_VERIFIED',
  'PHONE_TAKEN',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'OTP_RESEND_TOO_SOON',
  'TOKEN_EXPIRED',
  'ALREADY_APPLIED',
  'JOB_CLOSED',
  /** Người phỏng vấn đã có lịch trùng khung giờ */
  'SLOT_TAKEN',
  /** Email chưa xác thực bằng OTP (ứng tuyển nhanh nhiều việc) */
  'EMAIL_NOT_VERIFIED',
  'NOT_IMPLEMENTED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/* ---------------- Auth ---------------- */
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  phoneVerified: boolean;
  /** Có khi role = employer */
  employer: { id: string; slug: string; name: string } | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  /** Hết hạn access token (giây) */
  expiresIn: number;
  /** Chỉ trả cho mobile (platform ios/android). Web nhận qua cookie httpOnly */
  refreshToken?: string;
}

/** Đã gửi mã xác nhận tới email ứng tuyển */
export interface EmailOtpSentResponse {
  /** true: tài khoản đang đăng nhập đã xác thực email này – không cần nhập mã */
  verified: boolean;
  /** Email đã che: "la•••@gmail.com" */
  email: string;
  resendAfter: number;
  expiresIn: number;
  /** Chỉ có ở môi trường dev */
  devCode?: string;
}

export interface OtpSentResponse {
  phone: string;
  /** Giây phải chờ trước khi gửi lại */
  resendAfter: number;
  expiresIn: number;
  /** Chỉ có ở môi trường dev để test không cần SMS thật */
  devCode?: string;
}

export interface SessionItem {
  id: string;
  platform: Platform;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

/* ---------------- Việc làm ---------------- */
export interface RecruiterSummary {
  id: string;
  slug: string;
  name: string;
  title: string;
  photoUrl: string | null;
  rating: number;
  city: string | null;
}

export interface EmployerSummary {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
}

export interface JobListItem {
  id: string;
  code: string;
  slug: string;
  title: string;
  imageUrl: string;
  pref: string;
  region: RegionKey;
  program: Program;
  industry: Industry;
  salary: number;
  quantity: number;
  /** "12 nam", "15 nam nữ" */
  quantityText: string;
  gender: JobGender;
  birthYearFrom: number;
  birthYearTo: number;
  tags: JobTag[];
  badges: BadgeKind[];
  views: number;
  publishedAt: string | null;
  deadline: string | null;
  recruiter: RecruiterSummary;
  employer: EmployerSummary | null;
  /** Chỉ có khi đã đăng nhập */
  saved?: boolean;
  /** % phù hợp với hồ sơ (gợi ý việc làm) */
  matchScore?: number;
  /** Lý do phù hợp: "Hợp tuổi", "Đúng ngành"… */
  matchReasons?: string[];
}

export interface JobDetail extends JobListItem {
  status: JobStatus;
  departureAt: string | null;
  detail: JobDetailContent;
  applied?: boolean;
}

export interface JobFacets {
  total: number;
  programs: Record<Program, number>;
  regions: Record<RegionKey, number>;
  industries: Array<{ industry: Industry; count: number }>;
  tags: Array<{ tag: JobTag; count: number }>;
}

export interface RegionDirectoryItem {
  key: RegionKey;
  name: string;
  total: number;
  prefs: Array<{ name: string; count: number }>;
}

/* ---------------- Hồ sơ NTD ---------------- */
export interface EmployerProfile extends EmployerSummary {
  shortName: string | null;
  coverUrl: string | null;
  intro: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  /** Các khối nội dung linh hoạt: stats, values, offices, legal, contacts… */
  sections: Record<string, unknown>;
  team: RecruiterSummary[];
  followerCount: number;
  following?: boolean;
  jobCounts: Partial<Record<Program | 'all', number>>;
}

export interface RecruiterProfile extends RecruiterSummary {
  headline: string | null;
  intro: string | null;
  phoneMasked: string | null;
  employer: EmployerSummary | null;
  sections: Record<string, unknown>;
  followerCount: number;
  following?: boolean;
  jobCounts: Partial<Record<Program | 'all', number>>;
}

/* ---------------- Ứng tuyển ---------------- */
export interface ApplicationEventItem {
  status: ApplicationStatus;
  note: string | null;
  createdAt: string;
}

export interface ApplicationItem {
  id: string;
  status: ApplicationStatus;
  interviewAt: string | null;
  createdAt: string;
  job: Pick<JobListItem, 'id' | 'slug' | 'title' | 'imageUrl' | 'salary' | 'pref' | 'program'> & { employerName: string | null; code?: string; industry?: Industry };
  timeline: ApplicationEventItem[];
  /* Các trường dưới thêm cho design 19 (có ở GET /me/applications) */
  /** Mã hồ sơ "VP-58259" */
  code?: string;
  steps?: SeekerApplicationStepItem[];
  interview?: SeekerInterviewInfo | null;
  /** Cán bộ phụ trách hồ sơ – ứng viên được liên hệ trực tiếp */
  consultant?: { id: string; slug: string; name: string; title: string; photoUrl: string | null; phone: string | null; online: boolean } | null;
  /** Ghi chú mới nhất của cán bộ trên hồ sơ */
  latestNote?: { text: string; at: string } | null;
  withdrawable?: boolean;
}

export interface SeekerApplicationStepItem {
  key: SeekerApplicationStep;
  at: string | null;
  state: 'done' | 'current' | 'failed' | 'todo';
}

/** Buổi phỏng vấn sắp tới của hồ sơ (ứng viên xem) */
export interface SeekerInterviewInfo {
  id: string;
  kind: InterviewKind;
  startAt: string;
  endAt: string;
  platform: string | null;
  /** Chỉ trả khi còn ≤ 15 phút tới giờ hẹn (tránh lộ link sớm) */
  meetingUrl: string | null;
  linkOpensAt: string;
  location: string | null;
  partnerName: string | null;
  interviewers: string[];
  employerName: string | null;
  myStatus: AttendeeStatus;
}

export interface SeekerApplicationList extends Paginated<ApplicationItem> {
  counts: Record<SeekerApplicationTab, number>;
}

/** Ô số liệu + buổi phỏng vấn gần nhất (design 19) */
export interface SeekerApplicationSummary {
  processing: number;
  /** Thời gian cán bộ phản hồi trung bình ở các đơn bạn đang chờ (giờ) */
  avgResponseHours: number | null;
  upcomingInterviews: number;
  nextInterview: ApplicationItem | null;
  passed: number;
  latestPassed: { pref: string; note: string | null } | null;
  /** % hồ sơ được mời phỏng vấn */
  inviteRate: number | null;
  /** Cao hơn bao nhiêu % ứng viên khác (≥ 3 hồ sơ) */
  betterThan: number | null;
}

/** Việc đã lưu kèm điều kiện so với hồ sơ (design 20) */
export interface SavedJobItem extends JobListItem {
  savedAt: string;
  feeUsd: number | null;
  contractYears: number | null;
  jlptRequired: string | null;
  applied: boolean;
  /** Đủ điều kiện cứng (tuổi, giới tính) để ứng tuyển */
  eligible: boolean;
  matchNote: { ok: boolean; text: string };
  /** Nhãn nổi bật trên ảnh */
  highlight: { kind: 'expiring' | 'gender' | 'free' | 'quota'; text: string } | null;
}

export interface SavedJobList extends Paginated<SavedJobItem> {
  industries: Array<{ industry: Industry; count: number }>;
  /** Việc còn ≤ 3 ngày nhận hồ sơ, chưa ứng tuyển */
  expiringSoon: Array<{ id: string; title: string; pref: string; imageUrl: string; daysLeft: number }>;
}

export interface SavedJobsApplyResult {
  applied: string[];
  skipped: Array<{ jobId: string; reason: string }>;
}

/** Hồ sơ ứng viên nhà tuyển dụng nhìn thấy */
export interface ApplicantItem {
  id: string;
  status: ApplicationStatus;
  fullName: string;
  phone: string;
  email: string | null;
  birthYear: number;
  gender: Gender;
  address: string | null;
  note: string | null;
  interviewAt: string | null;
  createdAt: string;
  job: Pick<JobListItem, 'id' | 'slug' | 'title'>;
}

/* ---------------- Tài khoản ứng viên ---------------- */
export interface SeekerProfile {
  name: string;
  phone: string | null;
  email: string | null;
  birthYear: number | null;
  gender: Gender | null;
  hometown: string | null;
  address: string | null;
  programs: Program[];
  industries: Industry[];
  prefs: string[];
  jlpt: string | null;
  about: string | null;
  avatarUrl: string | null;
  videoUrl: string | null;
  lookingForJob: boolean;
  /** Cho phép NTD tìm thấy hồ sơ (số điện thoại ẩn tới khi ứng tuyển) */
  discoverable: boolean;
  /** Email đã xác thực bằng OTP (ứng tuyển không cần nhập lại mã) */
  emailVerified: boolean;
  heightCm: number | null;
  weightKg: number | null;
  eyesight: string | null;
  maritalStatus: MaritalStatus | null;
  tattoo: boolean | null;
  /** Lương mong muốn tối thiểu (yên / tháng) */
  desiredSalary: number | null;
  departWithin: '3' | '6' | '12' | null;
  maxFeeUsd: number | null;
  /** Đang học (khi chưa có chứng chỉ) */
  jlptLearning: JlptLevel | null;
  skills: SeekerSkill[];
  experiences: SeekerExperience[];
  /** Luôn đủ 5 mục giấy tờ theo SEEKER_DOCUMENT_KEYS */
  documents: SeekerDocument[];
  /** 0–100 */
  completion: number;
  /** Gợi ý bổ sung hồ sơ: "Thêm ảnh đại diện +8%"… */
  suggestions: Array<{ key: string; label: string; gain: number }>;
}

export interface SeekerSkill {
  name: string;
  level: number;
  note: string | null;
  /** Đã được cán bộ tư vấn xác nhận */
  verified: boolean;
}

export interface SeekerExperience {
  kind: 'work' | 'education';
  title: string;
  org: string;
  from: string;
  to: string | null;
  desc: string;
  tags: string[];
}

export interface SeekerDocument {
  key: SeekerDocumentKey;
  status: SeekerDocumentStatus;
  /** Ghi chú của cán bộ, vd. "hẹn 10/10" */
  note: string | null;
  uploadedAt: string | null;
}

/** Số liệu & NTD đã xem hồ sơ (design 18) */
export interface SeekerProfileInsights {
  views: { last7Days: number; delta: number };
  /** Đơn đang tuyển hợp tuổi, giới tính, chương trình, ngành */
  matchingJobs: number;
  /** Chỉ doanh nghiệp đã xác minh */
  viewers: Array<{ employer: EmployerSummary; count: number; lastAt: string }>;
}

export interface SeekerDashboard {
  applications: { total: number; updated: number };
  nextInterview: { applicationId: string; jobTitle: string; at: string } | null;
  saved: { total: number; expiringSoon: number };
  profileViews: { last7Days: number; delta: number };
  newMatchingJobs: number;
  consultant: RecruiterSummary | null;
  /** Liên hệ trực tiếp cán bộ tư vấn phụ trách (chỉ trả cho chính ứng viên) */
  consultantContact: { phone: string | null; online: boolean } | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Trạng thái lưu của một đơn với người đang đăng nhập */
export interface SavedJobState {
  saved: boolean;
}

/** Khách đăng ký tư vấn (khu nhà tuyển dụng) */
export interface LeadItem {
  id: string;
  name: string;
  phone: string;
  handledAt: string | null;
  createdAt: string;
  job: { title: string; slug: string } | null;
}

export interface PresignedUpload {
  uploadUrl: string;
  assetUrl: string;
  assetPath: string;
  expiresIn: number;
}

/* ---------------- App mobile ---------------- */
export interface AppConfig {
  /** Phiên bản app tối thiểu – thấp hơn thì bắt buộc cập nhật */
  minVersion: { ios: string; android: string };
  latestVersion: { ios: string; android: string };
  storeUrl: { ios: string; android: string };
  hotline: string;
  maintenance: boolean;
}

/* ---------------- Admin ---------------- */
export interface AdminMe {
  id: string;
  name: string;
  email: string;
  role: { key: string; name: string };
  permissions: AdminPermission[];
  mfaEnabled: boolean;
}

/** Kết quả từng bước đăng nhập admin */
export type AdminLoginResult =
  | { step: 'mfa'; challengeToken: string }
  | { step: 'mfa_setup'; challengeToken: string; secret: string; otpauthUrl: string }
  | { step: 'done'; accessToken: string; expiresIn: number; admin: AdminMe; recoveryCodes?: string[] };

export interface AdminBadges {
  pendingJobs: number;
  pendingVerifications: number;
  openReports: number;
}

/** Số liệu chưa có nguồn dữ liệu (module chưa tích hợp) trả null */
export interface KpiCard {
  key: string;
  label: string;
  value: number | null;
  /** % thay đổi so với kỳ trước (hoặc số phút với kpi thời gian) */
  delta: number | null;
  /** true = tăng là xấu (vd. thời gian duyệt) */
  inverse?: boolean;
  unit?: 'count' | 'vnd' | 'minutes';
  series: number[];
  note: string | null;
}

export interface DashboardInsight {
  tone: 'warning' | 'danger' | 'success';
  title: string;
  body: string;
  action: { label: string; href: string };
}

export interface ModerationItem {
  id: string;
  title: string;
  imageUrl: string;
  employerName: string;
  submittedAt: string;
  program: Program;
  industry: Industry;
  salary: number;
  employerVerified: boolean;
  reportCount: number;
  flag: string | null;
  risk: number;
  reasons: string[];
  /** Số phút còn lại tới hạn SLA (âm = quá hạn) */
  slaMinutes: number;
}

export interface VerificationItem {
  id: string;
  kind: 'company' | 'individual';
  name: string;
  subtitle: string;
  documents: Array<{ label: string; ok: boolean }>;
  status: 'pending' | 'needs_info';
}

export interface ReportGroup {
  reason: string;
  target: string;
  reporters: number;
  severity: 'high' | 'medium';
  latestAt: string;
}

export interface ActivityItem {
  type: 'job' | 'application' | 'moderation' | 'verification' | 'subscription' | 'admin';
  actor: string;
  text: string;
  at: string;
}

export interface AdminDashboard {
  range: DashboardRange;
  generatedAt: string;
  insights: DashboardInsight[];
  kpis: KpiCard[];
  applicationsDaily: {
    days: Array<{ date: string; count: number }>;
    total: number;
    delta: number | null;
    average: number;
    max: number;
    min: number;
    oneTapRate: number | null;
  };
  funnel: Array<{ label: string; value: number | null }>;
  moderationQueue: { total: number; items: ModerationItem[] };
  verifications: { total: number; items: VerificationItem[] };
  reports: { open: number; groups: ReportGroup[] };
  demandByPref: Array<{ pref: string; quota: number }>;
  revenue: null | { total: number; delta: number; sources: Array<{ label: string; value: number }> };
  activity: ActivityItem[];
  health: {
    status: 'ok' | 'degraded';
    dbLatencyMs: number;
    uptimeSeconds: number;
    otpSent24h: number;
    version: string;
  };
}

/* ================================================================== */
/* Khu quản lý nhà tuyển dụng (/employer/*)                           */
/* ================================================================== */

/** Tài khoản NTD đang đăng nhập – khung trang (thanh trên, menu trái, gói dịch vụ) */
export interface EmployerAccount {
  user: { id: string; name: string; avatarUrl: string | null; title: string };
  recruiter: { id: string; slug: string };
  /** company: thành viên doanh nghiệp · individual: NTD cá nhân / tư vấn viên */
  kind: 'company' | 'individual';
  company: { id: string; slug: string; name: string; shortName: string | null; logoUrl: string | null; verified: boolean; memberCount: number } | null;
  /** NTD cá nhân: đã xác minh CCCD */
  cccdVerified: boolean;
  plan: { name: string; expiresAt: string; jobQuota: number; jobsVisible: number; boostQuota: number; boostsUsed: number } | null;
  /** Số trên menu trái */
  counts: { jobs: number; newApplicants: number; upcomingInterviews: number; partners: number; reviews: number };
}

/** Một chỉ số có đường xu hướng theo ngày */
export interface TrendMetric {
  value: number;
  /** Giá trị kỳ trước cùng độ dài (tính % / chênh lệch) */
  previous: number;
  series: number[];
}

/** Hồ sơ ngắn trên dashboard / danh sách */
export interface ApplicantBrief {
  id: string;
  fullName: string;
  gender: Gender;
  age: number;
  hometown: string | null;
  /** Tên ngắn của đơn: "Lắp ráp điện tử – Saitama" */
  jobShortTitle: string;
  matchScore: number | null;
  phone: string;
  createdAt: string;
  /** Chưa liên hệ quá 24 giờ */
  overdue: boolean;
}

export interface InterviewBrief {
  id: string;
  kind: InterviewKind;
  startAt: string;
  endAt: string;
  /** Tên ứng viên hoặc "Nhóm 4 ứng viên" */
  title: string;
  /** "Lắp ráp điện tử – Saitama · Zoom" */
  subtitle: string;
  phase: 'upcoming' | 'live' | 'done';
}

export interface EmployerDashboard {
  range: EmployerRange;
  /** Hồ sơ mới chưa liên hệ quá 24 giờ */
  overdueApplicants: number;
  applications: TrendMetric & { topJob: string | null };
  visibleJobs: { value: number; added: number; expiringSoon: number; series: number[] };
  /** % hồ sơ được liên hệ trong 30 phút */
  fastResponse: TrendMetric & { target: number };
  views: TrendMetric;
  /** Thời gian phản hồi trung bình (phút) */
  responseMinutes: { value: number | null; previous: number | null; series: number[] };
  rating: { value: number; reviewCount: number; newReviews: number; series: number[] };
  departed: { value: number; inRange: number; series: number[] };
  daily: Array<{ date: string; count: number; weekend: boolean }>;
  funnel: { views: number; applied: number; contacted: number; interview: number; passed: number };
  latest: ApplicantBrief[];
  todayInterviews: InterviewBrief[];
  /** Doanh nghiệp: tin cần chú ý */
  attention: Array<{ jobId: string; kind: 'low_applicants' | 'expiring' | 'quota_full'; title: string; text: string }>;
  /** NTD cá nhân: doanh nghiệp phái cử */
  partners: EmployerPartnerItem[];
  /** NTD cá nhân: mức độ tin cậy */
  trust: { score: number; checks: Array<{ key: string; label: string; ok: boolean }>; percentile: number } | null;
}

export interface EmployerPartnerItem {
  id: string;
  employer: { id: string; name: string; slug: string; logoUrl: string | null; verified: boolean };
  jobCount: number;
  pendingJobs: number;
  departedCount: number;
  expiresAt: string | null;
  renewRequested: boolean;
}

/* ---------- Tin tuyển dụng của NTD (design 12) ---------- */
export interface EmployerJobItem {
  id: string;
  code: string;
  slug: string;
  title: string;
  /** "Lắp ráp điện tử – Saitama" */
  shortTitle: string;
  imageUrl: string;
  status: JobStatus;
  visibility: JobVisibility;
  industry: Industry;
  pref: string;
  program: Program;
  views: number;
  applications: number;
  /** Hồ sơ mới chưa xem */
  newApplications: number;
  passed: number;
  quantity: number;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  boostedAt: string | null;
  rejectReason: string | null;
  recruiter: { id: string; name: string; photoUrl: string | null };
}

export interface EmployerJobList extends Paginated<EmployerJobItem> {
  counts: Record<EmployerJobTab, number>;
}

export interface EmployerJobSummary {
  visible: number;
  /** Tin đang hiển thị hết hạn trong 45 ngày */
  expiringSoon: number;
  views7: number;
  viewsPrev7: number;
  newApplications7: number;
  /** Hồ sơ mới chưa xem */
  unseen: number;
  /** Tỉ lệ hồ sơ / lượt xem 30 ngày (%) của NTD và trung bình toàn sàn */
  conversion: number;
  marketConversion: number;
  passed: number;
  quota: number;
  sources: Array<{ source: ApplicationSource; count: number }>;
  activity: JobActivityItem[];
}

export interface JobActivityItem {
  id: string;
  actor: { name: string; photoUrl: string | null } | null;
  /** create | submit | draft | update | boost | pause | resume | close | approve | reject */
  action: string;
  jobCode: string;
  note: string | null;
  at: string;
}

export interface EmployerJobStats {
  job: EmployerJobItem;
  /** Hồ sơ / lượt xem (%) */
  conversion: number;
  daily: Array<{ date: string; count: number }>;
  suggestions: Array<{ kind: 'conversion_up' | 'conversion_down' | 'unseen' | 'expiring'; text: string; target: 'applicants' | 'edit' | null }>;
}

/* ---------- Quản lý ứng viên của NTD (design 13) ---------- */
export interface EmployerApplicantItem {
  id: string;
  fullName: string;
  gender: Gender;
  age: number;
  hometown: string | null;
  phone: string;
  job: { id: string; shortTitle: string };
  tags: string[];
  matchScore: number | null;
  status: ApplicationStatus;
  stage: ApplicantStage;
  /** NTD chưa mở xem hồ sơ */
  unseen: boolean;
  /** Mới và chưa liên hệ quá 24 giờ */
  overdue: boolean;
  createdAt: string;
}

export interface EmployerApplicantList extends Paginated<EmployerApplicantItem> {
  stageCounts: Record<ApplicantStage | 'all', number>;
  stageNotes: { unseen: number; avgContactHours: number | null; interviewsThisWeek: number; passRate: number };
  quickCounts: { unseen: number; passport: number; match90: number; overdue: number };
  jobs: Array<{ id: string; shortTitle: string; count: number }>;
}

export interface ApplicantNoteItem {
  id: string;
  author: { name: string; photoUrl: string | null } | null;
  body: string;
  createdAt: string;
}

export interface EmployerApplicantDetail extends EmployerApplicantItem {
  email: string | null;
  address: string | null;
  maritalStatus: string | null;
  heightCm: number | null;
  weightKg: number | null;
  education: string | null;
  experience: string | null;
  jlpt: string | null;
  passport: string | null;
  departWithin: string | null;
  note: string | null;
  source: ApplicationSource;
  interviewAt: string | null;
  documents: Array<{ name: string; kind: 'pdf' | 'image'; sizeKb: number }>;
  matchReasons: Array<{ ok: boolean; text: string }>;
  events: Array<{ status: ApplicationStatus; note: string | null; createdAt: string }>;
  notes: ApplicantNoteItem[];
  assignee: { id: string; name: string } | null;
}

/* ---------- Lịch phỏng vấn (design 14, 17) ---------- */
export interface InterviewAttendeeItem {
  applicationId: string;
  fullName: string;
  phone: string;
  jobShortTitle: string;
  status: AttendeeStatus;
}

export interface InterviewerItem {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
}

export interface EmployerInterviewItem {
  id: string;
  kind: InterviewKind;
  status: InterviewStatus;
  startAt: string;
  endAt: string;
  platform: string | null;
  meetingUrl: string | null;
  location: string | null;
  partnerName: string | null;
  note: string | null;
  result: string | null;
  channels: string[];
  attendees: InterviewAttendeeItem[];
  interviewers: InterviewerItem[];
}

export interface EmployerInterviewWeek {
  from: string;
  to: string;
  items: EmployerInterviewItem[];
  stats: {
    total: number;
    remainingToday: number;
    /** Số lịch mọi ứng viên đã xác nhận / tham gia */
    confirmed: number;
    /** Số lịch còn ứng viên chưa xác nhận (chưa diễn ra) */
    pending: number;
    /** % vắng mặt tháng này và tháng trước */
    noShowRate: number | null;
    noShowRatePrev: number | null;
  };
  kindCounts: Record<InterviewKind, number>;
  interviewers: Array<InterviewerItem & { count: number }>;
}

/* ---------- Form đăng tin / sửa tin (design 15) ---------- */
export interface EmployerJobForm {
  id: string;
  code: string;
  status: JobStatus;
  title: string;
  imageUrl: string;
  pref: string;
  program: Program;
  industry: Industry;
  position: string | null;
  salary: number;
  quantity: number;
  gender: JobGender;
  birthYearFrom: number;
  birthYearTo: number;
  departureAt: string | null;
  deadline: string | null;
  examAt: string | null;
  feeUsd: number | null;
  contractYears: number | null;
  jlptRequired: string | null;
  visibility: JobVisibility;
  recruiterId: string;
  posting: JobPosting | null;
}

/** Thông tin thị trường cho form đăng tin: khoảng lương cùng ngành / tỉnh, ước tính tiếp cận */
export interface JobMarketInsight {
  salary: { min: number; median: number; max: number; sample: number } | null;
  /** Người lao động đang tìm việc phù hợp chương trình / ngành / độ tuổi */
  seekers: number;
  /** Hồ sơ dự kiến trong 30 ngày (theo trung bình tin cùng ngành) */
  expectedApplications: number;
  /** Số ngày dự kiến đủ chỉ tiêu */
  daysToFill: number | null;
}

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
  isMe: boolean;
}

/* ---------- Thêm ứng viên (design 16) ---------- */
export interface ApplicantDuplicateItem {
  id: string;
  fullName: string;
  hometown: string | null;
  jobShortTitle: string;
  createdAt: string;
}

export interface ApplicantDuplicateCheck {
  /** Số đã ứng tuyển các đơn của NTD */
  phoneMatches: ApplicantDuplicateItem[];
  /** Tên gần giống (cùng tên gọi) */
  similarNames: ApplicantDuplicateItem[];
  /** Tổng hồ sơ NTD đang có (đã kiểm tra) */
  checked: number;
}

export interface ApplicantJobMatch {
  job: { id: string; code: string; title: string; shortTitle: string; imageUrl: string };
  score: number;
  /** Lý do chính (đạt / chưa đạt) */
  reason: { ok: boolean; text: string };
}

export interface ApplicantImportResult {
  created: number;
  skipped: Array<{ row: number; reason: string }>;
}

/* ---------- Tạo lịch hẹn (design 17) ---------- */
export interface InterviewCandidate {
  applicationId: string;
  fullName: string;
  gender: Gender;
  age: number;
  hometown: string | null;
  phone: string;
  jobShortTitle: string;
  matchScore: number | null;
  stage: ApplicantStage;
}

/** Lịch bận của người phỏng vấn theo ngày (tính khung giờ trống ở client) */
export interface InterviewAvailability {
  days: Array<{
    date: string;
    busy: Array<{ recruiterId: string; start: string; end: string; kind: InterviewKind }>;
  }>;
}
