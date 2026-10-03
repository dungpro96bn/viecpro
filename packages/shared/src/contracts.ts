/**
 * Kiểu dữ liệu API trả về (response). Web và mobile dùng chung để gọi API có kiểu.
 * Ngày giờ trả về dạng chuỗi ISO 8601; URL ảnh luôn là URL tuyệt đối.
 */
import type {
  AlertChannel,
  AlertFrequency,
  ApplicantStage,
  ApplicationSource,
  ApplicationStatus,
  AttendeeStatus,
  BadgeKind,
  DashboardRange,
  EmployerJobTab,
  EmployerRange,
  Gender,
  Industry,
  InterviewKind,
  InterviewStatus,
  JlptLevel,
  JobGender,
  JobStatus,
  JobTag,
  JobVisibility,
  Locale,
  MaritalStatus,
  NotificationGroup,
  PhoneVisibility,
  Platform,
  Program,
  RegionKey,
  ReportDecision,
  ReportSeverity,
  ReportStatus,
  ReportTarget,
  ResetChannel,
  Role,
  SeekerApplicationStep,
  SeekerApplicationTab,
  SeekerDocumentKey,
  SeekerDocumentStatus,
  Theme,
  TrashCategory,
  VerificationStatus,
} from './enums.js';
import type { AdminPermission } from './admin.js';
import type { JobDetailContent, JobPosting } from './schemas/jobs.js';
import type { JobAlertCriteria } from './schemas/account.js';
import type { CompanyProfileSections, RecruiterProfileSections } from './schemas/employer-profile.js';

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
  /** Email đã thuộc tài khoản khác (đổi email trong Cài đặt) */
  'EMAIL_TAKEN',
  /** Vượt số thông báo việc làm tối đa */
  'ALERT_LIMIT',
  'PLAN_LIMIT',
  'PLAN_EXPIRED',
  /** Đã báo cáo đối tượng này và báo cáo còn đang xử lý */
  'ALREADY_REPORTED',
  /** Đối tượng đang bị tạm khoá / tạm ẩn bởi quản trị */
  'SUSPENDED',
  'NOT_IMPLEMENTED',
  /** Admin đang dùng mật khẩu tạm – phải đổi mật khẩu trước khi dùng khu quản trị */
  'PASSWORD_CHANGE_REQUIRED',
  /** Cán bộ đã bị quản trị viên doanh nghiệp gỡ khỏi doanh nghiệp */
  'MEMBER_REMOVED',
  /** Hệ thống đang bảo trì (admin bật trong Cài đặt hệ thống) */
  'MAINTENANCE',
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
  rating?: number;
  reviewCount?: number;
  reviews?: EmployerReviewPublicItem[];
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
  reviews: EmployerReviewPublicItem[];
}

export interface EmployerReviewPublicItem {
  id: string;
  rating: number;
  comment: string;
  response: string | null;
  createdAt: string;
}

export interface EmployerReviewReceipt {
  id: string;
  rating: number;
}

export interface EmployerReviewMine extends EmployerReviewReceipt {}

export interface EmployerReviewItem extends EmployerReviewPublicItem {
  applicationId: string;
  recruiterName: string;
  recruiterResponseAt: string | null;
}

export interface EmployerReviewList extends Paginated<EmployerReviewItem> {
  average: number;
  distribution: Array<{ rating: number; count: number }>;
  awaitingResponse: number;
}

export interface EmployerReport {
  range: '7' | '30' | '90';
  totalApplications: number;
  totalViews: number;
  conversion: number;
  previousApplications: number;
  previousViews: number;
  daily: Array<{ date: string; applications: number; views: number }>;
  sources: Array<{ source: ApplicationSource; count: number }>;
  jobs: Array<{ id: string; title: string; code: string; views: number; applications: number; conversion: number }>;
  funnel: { applied: number; contacted: number; interview: number; passed: number; departed: number };
}

/* ---------------- Khu NTD: cài đặt hồ sơ công khai ---------------- */
export interface EmployerProfileSettings {
  kind: 'company' | 'individual';
  recruiter: {
    slug: string;
    name: string;
    title: string;
    headline: string | null;
    intro: string | null;
    city: string | null;
    phone: string | null;
    photoUrl: string | null;
    sections: RecruiterProfileSections;
  };
  company: {
    slug: string;
    /** Tên pháp lý / MST: đổi qua xác minh lại với admin */
    name: string;
    taxCode: string | null;
    verified: boolean;
    shortName: string | null;
    intro: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    sections: CompanyProfileSections;
    /** Người đang xem là quản trị viên doanh nghiệp (được sửa hồ sơ công ty) */
    canEdit: boolean;
  } | null;
}

/* ---------------- Khu NTD: thành viên doanh nghiệp ---------------- */
export interface CompanyMember {
  id: string;
  slug: string;
  name: string;
  title: string;
  photoUrl: string | null;
  /** Số / email đăng nhập (chỉ hiện trong nội bộ doanh nghiệp) */
  phone: string | null;
  email: string | null;
  companyAdmin: boolean;
  /** false = hồ sơ hiển thị, chưa có tài khoản đăng nhập */
  hasAccount: boolean;
  isSelf: boolean;
  lastLoginAt: string | null;
  openJobs: number;
  activeApplicants: number;
}

export interface CompanyMemberInvite {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  title: string;
  companyAdmin: boolean;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface CompanyMembers {
  /** Người xem là quản trị viên doanh nghiệp (mời, đổi quyền, gỡ thành viên) */
  canManage: boolean;
  limit: number;
  members: CompanyMember[];
  /** Lời mời chưa nhận – chỉ trả cho quản trị viên */
  invites: CompanyMemberInvite[];
}

export interface MemberInviteSent {
  invite: CompanyMemberInvite;
  /** Chỉ có ngoài production: link mời để thử khi SMS / email đang in ra log */
  devLink?: string;
}

/** Trang nhận lời mời (công khai, theo token) */
export interface MemberInvitePreview {
  companyName: string;
  companyLogoUrl: string | null;
  inviterName: string;
  name: string;
  title: string;
  phoneMasked: string;
  expiresAt: string;
}

/* ---------------- Khu NTD: Thùng rác ---------------- */
export interface TrashSummary {
  categories: Array<{ key: TrashCategory; label: string; count: number }>;
}

export interface TrashedMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  hasAccount: boolean;
  removedAt: string;
  removedBy: string | null;
  /** Thời điểm hệ thống tự xoá vĩnh viễn (removedAt + TRASH_RETENTION_DAYS) */
  purgeAt: string;
  /** Lịch sử được giữ lại: tin đã đăng (đã đóng / không bàn giao), ghi chú hồ sơ */
  keptJobs: number;
  keptNotes: number;
  /** Chuỗi phải gõ đúng để xoá vĩnh viễn (tên thành viên) */
  confirmText: string;
}

export interface TrashedJob {
  id: string;
  code: string;
  title: string;
  /** Trạng thái lúc xoá – khôi phục giữ nguyên trạng thái này */
  status: JobStatus;
  removedAt: string;
  removedBy: string | null;
  purgeAt: string;
  /** Hồ sơ ứng tuyển vẫn được giữ và theo dõi ở mục Ứng viên */
  applications: number;
  /** Chuỗi phải gõ đúng để xoá vĩnh viễn (mã tin) */
  confirmText: string;
}

/* ---------------- Ứng tuyển ---------------- */
export interface ApplicationEventItem {
  status: ApplicationStatus;
  note: string | null;
  createdAt: string;
}

export interface ApplicationItem {
  id: string;
  /** Cuộc trò chuyện được mở trước bởi NTD; null khi NTD chưa mở */
  conversationId?: string | null;
  unreadMessages?: number;
  status: ApplicationStatus;
  interviewAt: string | null;
  createdAt: string;
  /** `removed`: NTD đã gỡ tin – vẫn theo dõi được hồ sơ nhưng không mở trang tin */
  job: Pick<JobListItem, 'id' | 'slug' | 'title' | 'imageUrl' | 'salary' | 'pref' | 'program'> & { employerName: string | null; code?: string; industry?: Industry; removed?: boolean };
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
  /** Đánh giá do chính ứng viên gửi cho cán bộ của đơn này */
  review?: { id: string; rating: number } | null;
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
  /** Luôn đủ 4 mục giấy tờ theo SEEKER_DOCUMENT_KEYS */
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
  /** Tư vấn viên được nhờ (khách gửi từ trang cá nhân của cán bộ) */
  recruiter: { name: string } | null;
}

export interface EmployerLeadList extends Paginated<LeadItem> {
  tabs: { unhandled: number; handled: number };
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
  /** Đang dùng mật khẩu tạm do admin khác cấp – giao diện bắt đổi trước khi làm việc */
  mustChangePassword: boolean;
}

/* ---------- Phân quyền (A-11) ---------- */
export interface AdminAccountItem {
  id: string;
  name: string;
  email: string;
  role: { id: string; key: string; name: string };
  mfaEnabled: boolean;
  lockedAt: string | null;
  lockReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  /** Là tài khoản đang đăng nhập (không tự đổi vai trò / tự khoá) */
  isSelf: boolean;
}

export interface AdminAccountList extends Paginated<AdminAccountItem> {
  stats: { total: number; active: number; locked: number; mfaPending: number };
}

/** Tạo admin / đặt lại mật khẩu: mật khẩu tạm chỉ trả 1 lần, người nhận đổi sau khi đăng nhập */
export interface AdminTemporaryPassword {
  admin: AdminAccountItem;
  temporaryPassword: string;
}

export interface AdminRoleItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: AdminPermission[];
  /** Vai trò mặc định – không xoá được */
  isSystem: boolean;
  adminCount: number;
  updatedAt: string;
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

/** Trạng thái xoá của tin phía NTD (thùng rác) – hiện cho admin */
export type JobRemoval = 'trash' | 'purged';

export interface ModerationItem {
  id: string;
  /** Mã tin VP-10231 */
  code: string;
  status: JobStatus;
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
  /** Tab "Đã xử lý" / "Yêu cầu sửa": thời điểm, người xử lý, lý do */
  moderatedAt: string | null;
  moderatorName: string | null;
  rejectReason: string | null;
  changesRequested: boolean;
  /** NTD đã xoá tin: 'trash' – còn trong thùng rác NTD (khôi phục được), 'purged' – đã xoá vĩnh viễn */
  removedByOwner: JobRemoval | null;
}

export interface ModerationList extends Paginated<ModerationItem> {
  stats: { pending: number; nearSla: number; processedToday: number };
  tabs: { pending: number; changes: number; done: number };
}

/** Kết quả một mục kiểm tra tự động (A-02) */
export interface ModerationCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  note: string | null;
}

export interface ModerationDetail extends ModerationItem {
  slug: string;
  region: RegionKey;
  pref: string;
  quantity: number;
  gender: JobGender;
  birthYearFrom: number;
  birthYearTo: number;
  feeUsd: number | null;
  contractYears: number | null;
  jlptRequired: string | null;
  examAt: string | null;
  deadline: string | null;
  departureAt: string | null;
  employer: { name: string; verified: boolean; createdAt: string | null; openJobs: number } ;
  recruiterName: string;
  content: { overview: string; tasks: string[]; requirements: Array<[string, string]>; benefits: string[]; incomes: Array<{ label: string; value: string }> };
  medianSalary: number | null;
  checks: ModerationCheck[];
  events: Array<{ action: string; note: string | null; actor: string | null; at: string }>;
  reports: Array<{ code: string; reason: string; status: ReportStatus; createdAt: string }>;
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
  recruiter: { id: string; slug: string; verified: boolean };
  /** company: thành viên doanh nghiệp · individual: NTD cá nhân / tư vấn viên */
  kind: 'company' | 'individual';
  company: { id: string; slug: string; name: string; shortName: string | null; logoUrl: string | null; verified: boolean; memberCount: number } | null;
  plan: { name: string; expiresAt: string; jobQuota: number; jobsVisible: number; boostQuota: number; boostsUsed: number } | null;
  /** Quản trị viên doanh nghiệp: quản lý thành viên, hồ sơ công ty, Thùng rác */
  companyAdmin: boolean;
  /** Số trên menu trái (trash: số mục trong Thùng rác – chỉ tính cho quản trị viên doanh nghiệp) */
  counts: { jobs: number; visibleJobs: number; unreadMessages: number; newApplicants: number; upcomingInterviews: number; partners: number; partnerJobs: number; partnerRecruiters: number; reviews: number; trash: number; /** Khách cần tư vấn chưa xử lý */ leads: number };
}

export interface PartnerJobItem {
  id: string;
  code: string;
  slug: string;
  title: string;
  status: JobStatus;
  applications: number;
  createdAt: string;
  recruiter: { id: string; slug: string; name: string };
}

export interface PartnerApplicantItem {
  id: string;
  fullName: string;
  gender: Gender;
  age: number;
  hometown: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  status: ApplicationStatus;
  createdAt: string;
  job: { id: string; title: string; slug: string };
  contactMasked: boolean;
}

export type PartnerApplicantList = Paginated<PartnerApplicantItem>;

export interface PartnerViewItem {
  employerName: string;
  viewedAt: string;
}

export interface ConversationMessageItem {
  id: string;
  senderSide: 'employer' | 'seeker';
  senderUserId: string | null;
  body: string;
  flagged: boolean;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  applicationId: string;
  participantName: string;
  jobTitle: string;
  lastMessage: ConversationMessageItem | null;
  unread: number;
  lastMessageAt: string;
}

export interface ConversationMessages {
  items: ConversationMessageItem[];
  before: string | null;
  after: string | null;
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
  /** `url` = link xem / tải tệp; null với giấy tờ chỉ ghi tên (chưa tải tệp lên) */
  documents: Array<{ name: string; kind: 'pdf' | 'image'; sizeKb: number; url: string | null }>;
  matchReasons: Array<{ ok: boolean; text: string }>;
  events: Array<{ status: ApplicationStatus; note: string | null; createdAt: string }>;
  notes: ApplicantNoteItem[];
  assignee: { id: string; name: string } | null;
  /** Lượt xem của doanh nghiệp phái cử (chỉ trả cho NTD cá nhân) */
  partnerViews?: PartnerViewItem[];
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

/* ================================================================== */
/* Quên mật khẩu (design 03)                                          */
/* ================================================================== */
/**
 * Luôn trả cùng dạng dù tài khoản có tồn tại hay không (RULE-BE.md mục 5.3).
 * `sentTo` chỉ che lại chính giá trị người dùng đã nhập, không tra từ tài khoản.
 */
export interface PasswordResetSent {
  channel: ResetChannel;
  sentTo: string | null;
  resendAfter: number;
  expiresIn: number;
  /** Chỉ có ở môi trường dev */
  devCode?: string;
}

/* ================================================================== */
/* Thông báo việc làm (design 04)                                     */
/* ================================================================== */
export interface JobAlertItem {
  id: string;
  name: string;
  criteria: JobAlertCriteria;
  /** Chip hiển thị: ["Điện tử", "Kanto", "Thực tập sinh", "+2"] đã rút gọn sẵn ở client */
  chips: string[];
  channels: AlertChannel[];
  frequency: AlertFrequency;
  enabled: boolean;
  /** Việc mới khớp tiêu chí từ lần xem gần nhất */
  newCount: number;
  lastSentAt: string | null;
  createdAt: string;
}

export interface JobAlertList {
  items: JobAlertItem[];
  total: number;
  enabledCount: number;
  /** Tổng việc mới chưa xem của mọi thông báo đang bật */
  unseen: number;
  max: number;
}

/** "Việc mới cho bạn" – có % phù hợp */
export interface AlertFeedItem extends JobListItem {
  matchScore: number;
}

/** Gợi ý tạo thông báo từ hồ sơ ("Kiểm tra ngoại quan · Chiba · Nữ – 8 việc phù hợp mới trong tuần") */
export interface JobAlertSuggestion {
  name: string;
  criteria: JobAlertCriteria;
  /** Số việc khớp đăng trong 7 ngày */
  weeklyCount: number;
  reason: string;
}

/* ================================================================== */
/* Cài đặt (design 05)                                                */
/* ================================================================== */
export type ChannelToggles = Record<AlertChannel, boolean>;

export interface SeekerSettings {
  account: {
    email: string | null;
    emailVerified: boolean;
    phone: string | null;
    phoneVerified: boolean;
    hasPassword: boolean;
    passwordChangedAt: string | null;
    googleLinked: boolean;
  };
  notifications: Record<NotificationGroup, ChannelToggles>;
  quietHours: { enabled: boolean; from: string; to: string };
  privacy: { discoverable: boolean; phoneVisibility: PhoneVisibility };
  locale: Locale;
  theme: Theme;
}

/** Bản xuất dữ liệu cá nhân (Nghị định 13/2023 – quyền truy cập dữ liệu) */
export interface PersonalDataExport {
  exportedAt: string;
  account: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  applications: Array<Record<string, unknown>>;
  savedJobs: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
}

/* ================================================================== */
/* Báo cáo vi phạm (M18 + A-06)                                       */
/* ================================================================== */
export interface ReportCreated {
  /** Mã hiển thị BC-xxxx */
  code: string;
  /** Hạn xử lý dự kiến */
  dueAt: string;
}

/** Báo cáo của tôi – người báo cáo chỉ thấy trạng thái và kết quả, không thấy ghi chú nội bộ */
export interface MyReportItem {
  code: string;
  targetType: ReportTarget;
  targetName: string;
  reason: string;
  status: ReportStatus;
  /** Kết quả rút gọn khi đã xử lý */
  outcome: string | null;
  createdAt: string;
}

/** Một "vụ" báo cáo = các báo cáo cùng đối tượng, cùng lý do đang mở */
export interface AdminReportItem {
  id: string;
  code: string;
  targetType: ReportTarget;
  targetId: string | null;
  targetName: string;
  /** "Tin đăng · Đông Á Nhân Lực · BC-4821" */
  targetMeta: string;
  reason: string;
  reasonLabel: string;
  /** Mô tả đầu tiên có nội dung */
  detail: string | null;
  severity: ReportSeverity;
  /** Đối tượng đã từng bị xác nhận vi phạm */
  repeatOffender: boolean;
  reporterCount: number;
  /** Chữ cái đầu người báo cáo (ẩn danh) – "AI" khi hệ thống tự gắn cờ */
  reporterInitials: string[];
  status: ReportStatus;
  dueAt: string | null;
  /** Phút còn lại tới hạn (âm = quá hạn) */
  dueMinutes: number | null;
  assignee: { id: string; name: string; isMe: boolean } | null;
  decision: ReportDecision | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminReportList extends Paginated<AdminReportItem> {
  stats: {
    open: number;
    openToday: number;
    overdue: number;
    /** Thời gian xử lý trung bình 7 ngày (giờ) */
    avgHandleHours: number | null;
    /** % báo cáo được xác nhận vi phạm (30 ngày) */
    confirmedRate: number | null;
  };
  tabs: { open: number; resolved: number; dismissed: number };
}

export interface AdminReportDetail extends AdminReportItem {
  reports: Array<{ code: string; reason: string; detail: string | null; reporter: string; contact: string | null; createdAt: string }>;
  target: { type: ReportTarget; id: string | null; name: string; link: string | null; status: string | null; previousViolations: number };
  decisionNote: string | null;
}

/** Khách đăng ký tư vấn trong trang quản trị */
export interface AdminLeadItem {
  id: string;
  name: string;
  /** Bị che nếu admin không có users.pii */
  phone: string;
  handledAt: string | null;
  createdAt: string;
  job: { title: string; slug: string } | null;
  employer: { name: string } | null;
  recruiter: { name: string } | null;
}

export interface AdminLeadList extends Paginated<AdminLeadItem> {
  tabs: { unhandled: number; handled: number };
}

/* ================================================================== */
/* Admin – xác minh (design 08)                                       */
/* ================================================================== */
export interface VerificationListItem {
  id: string;
  kind: 'company' | 'individual';
  name: string;
  /** "Công ty XKLĐ" / "NTD cá nhân" */
  kindLabel: string;
  /** "MST 0109•••482 · Hà Nội" */
  subtitle: string;
  documents: Array<{ key: string; label: string; ok: boolean }>;
  validDocs: number;
  totalDocs: number;
  /** Điểm đối chiếu tự động 0–100 */
  autoScore: number;
  /** "Tất cả khớp" hoặc "Giấy phép XKLĐ – lỗi (+1)" */
  autoSummary: string;
  status: VerificationStatus;
  note: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface VerificationList extends Paginated<VerificationListItem> {
  stats: { pending: number; missingDocs: number; suspicious: number; approvedThisMonth: number; avgReviewMinutes: number | null };
  tabs: Record<VerificationStatus, number>;
}

/* ================================================================== */
/* Admin – ứng viên (design 09)                                       */
/* ================================================================== */
export type AdminSeekerStatus = 'seeking' | 'interviewing' | 'passed' | 'departed' | 'locked' | 'idle';

export interface AdminSeekerItem {
  id: string;
  /** UV-20481 */
  code: string;
  name: string;
  gender: Gender | null;
  age: number | null;
  hometown: string | null;
  /** Ngành / chương trình mong muốn đầu tiên */
  industry: string | null;
  program: Program | null;
  jlpt: string | null;
  completion: number;
  applicationCount: number;
  reportCount: number;
  isNew: boolean;
  lastActiveAt: string | null;
  status: AdminSeekerStatus;
  /** Liên hệ đã che – bấm "Hiện" cần quyền users.pii (ghi nhật ký) */
  phoneMasked: string | null;
  emailMasked: string | null;
}

export interface AdminSeekerList extends Paginated<AdminSeekerItem> {
  stats: {
    total: number;
    newThisWeek: number;
    seeking: number;
    /** % hồ sơ đạt ≥ 80% */
    completeRate: number;
    reported: number;
    reportedOpen: number;
  };
  tabs: Record<'all' | 'seeking' | 'interviewing' | 'passed' | 'locked', number>;
}

export interface AdminSeekerDetail extends AdminSeekerItem {
  createdAt: string;
  lockedAt: string | null;
  lockReason: string | null;
  address: string | null;
  prefs: string[];
  programs: Program[];
  industries: string[];
  applications: Array<{ id: string; jobTitle: string; employerName: string | null; status: ApplicationStatus; createdAt: string }>;
  reports: Array<{ code: string; reason: string; status: ReportStatus; createdAt: string }>;
}

export interface RevealedContact {
  phone: string | null;
  email: string | null;
}

/* ================================================================== */
/* Admin – nhà tuyển dụng (design 10)                                 */
/* ================================================================== */
export type AdminEmployerStatus = 'active' | 'pending' | 'expiring' | 'suspended';

export interface AdminEmployerItem {
  /** "company:<employerId>" hoặc "individual:<recruiterId>" */
  key: string;
  kind: 'company' | 'individual';
  id: string;
  name: string;
  logoUrl: string | null;
  /** "MST 0109•••482 · Hà Nội" / "SĐT 098•••4521 · Nghệ An · Liên kết: Minh Phát Global" */
  subtitle: string;
  verified: boolean;
  reportCount: number;
  openJobs: number;
  totalJobs: number;
  applicants30d: number;
  /** % thay đổi so với 30 ngày trước */
  applicantsDelta: number | null;
  /** % hồ sơ đã được phản hồi (đã xem / liên hệ) */
  responseRate: number | null;
  plan: { name: string; expiresAt: string; daysLeft: number } | null;
  status: AdminEmployerStatus;
}

export interface AdminEmployerList extends Paginated<AdminEmployerItem> {
  stats: { total: number; newThisMonth: number; withOpenJobs: number; paid: number; expiring: number };
  kinds: { all: number; company: number; individual: number };
  tabs: Record<AdminEmployerStatus | 'all', number>;
}

export interface AdminEmployerDetail extends AdminEmployerItem {
  createdAt: string;
  suspendedAt: string | null;
  suspendReason: string | null;
  contact: { phone: string | null; email: string | null; website: string | null; address: string | null };
  /** Thành viên đang hoạt động trước, người đã rời doanh nghiệp (leftAt) sau – giữ để tra cứu lịch sử */
  members: Array<{ id: string; name: string; title: string; locked: boolean; leftAt: string | null }>;
  partners: Array<{ id: string; name: string; expiresAt: string | null }>;
  jobs: Array<{ id: string; code: string; title: string; status: JobStatus; applicants: number; suspended: boolean; createdAt: string }>;
  violations: Array<{ code: string; reason: string; status: ReportStatus; decision: ReportDecision | null; createdAt: string }>;
  history: AuditLogItem[];
}

/* ================================================================== */
/* Admin – nhật ký hệ thống (A-12)                                    */
/* ================================================================== */
export interface AuditLogItem {
  id: string;
  actor: { id: string; name: string };
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}
