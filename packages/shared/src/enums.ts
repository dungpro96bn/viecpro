/**
 * Hằng số liệt kê dùng chung giữa web, API và mobile.
 * Giá trị (key) là thứ lưu trong database và đi qua API – KHÔNG đổi tên khi đã có dữ liệu thật.
 */

/** Chương trình: thực tập sinh, kỹ năng đặc định, kỹ sư */
export const PROGRAMS = ['tts', 'tok', 'ks'] as const;
export type Program = (typeof PROGRAMS)[number];

/** Vùng Nhật Bản */
export const REGIONS = ['hkt', 'kanto', 'chubu', 'kansai', 'cs', 'kyu'] as const;
export type RegionKey = (typeof REGIONS)[number];

/** Nhãn trạng thái tin: mới / hot / gấp */
export const BADGES = ['new', 'hot', 'urgent'] as const;
export type BadgeKind = (typeof BADGES)[number];

/** Đặc điểm đơn hàng (hiển thị nguyên văn) */
export const JOB_TAGS = ['Lương cao', 'Phí thấp', 'Đơn miễn phí', 'Tăng ca nhiều', 'Xuất cảnh nhanh', 'Bảo lãnh gia đình'] as const;
export type JobTag = (typeof JOB_TAGS)[number];

/** Ngành nghề */
export const INDUSTRIES = [
  'Xây dựng',
  'Điện tử – Lắp ráp',
  'Chế biến thực phẩm',
  'Nông nghiệp',
  'Điều dưỡng – Kaigo',
  'Nhà hàng – Khách sạn',
  'Cơ khí',
  'Công nghệ thông tin',
  'Khác',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Giới tính người dùng */
export const GENDERS = ['nam', 'nu'] as const;
export type Gender = (typeof GENDERS)[number];

/** Giới tính đơn hàng tuyển */
export const JOB_GENDERS = ['nam', 'nu', 'both'] as const;
export type JobGender = (typeof JOB_GENDERS)[number];

/** Vai trò tài khoản */
export const ROLES = ['seeker', 'employer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Trạng thái đơn hàng: nháp → chờ duyệt → đang tuyển (có thể tạm ẩn) / bị từ chối → đã đóng */
export const JOB_STATUSES = ['draft', 'pending', 'open', 'paused', 'rejected', 'closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Trạng thái hồ sơ ứng tuyển (theo thứ tự tiến trình). viewed = cán bộ đã xem / đã liên hệ */
export const APPLICATION_STATUSES = ['submitted', 'viewed', 'interview', 'passed', 'departed', 'rejected', 'withdrawn'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Mục đích mã OTP */
export const OTP_PURPOSES = ['register', 'login', 'reset_password', 'change_phone', 'join_company'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Mục đích OTP gửi qua email (khớp enum EmailOtpPurpose của Prisma) */
export const EMAIL_OTP_PURPOSES = ['apply', 'reset_password', 'change_email'] as const;
export type EmailOtpPurpose = (typeof EMAIL_OTP_PURPOSES)[number];

/** Nền tảng thiết bị (phiên đăng nhập, push) */
export const PLATFORMS = ['web', 'ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Sắp xếp kết quả tìm kiếm */
export const JOB_SORTS = ['relevance', 'newest', 'salary', 'departure'] as const;
export type JobSort = (typeof JOB_SORTS)[number];

/** Khoảng dự kiến xuất cảnh (tháng) */
export const DEPARTURE_WITHIN = ['3', '6', '12'] as const;
export type DepartureWithin = (typeof DEPARTURE_WITHIN)[number];

/** Trạng thái xác minh doanh nghiệp / NTD cá nhân */
export const VERIFICATION_STATUSES = ['pending', 'needs_info', 'approved', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Trạng thái báo cáo vi phạm: mở → đang xử lý (đã có người nhận) → đã xử lý / bỏ qua */
export const REPORT_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Khoảng thời gian trên bảng điều khiển admin */
export const DASHBOARD_RANGES = ['today', '7d', '30d', 'quarter'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

/** Gói hiển thị tin: tiêu chuẩn / nổi bật / tuyển gấp */
export const JOB_VISIBILITIES = ['standard', 'featured', 'urgent'] as const;
export type JobVisibility = (typeof JOB_VISIBILITIES)[number];

/** Nguồn hồ sơ ứng tuyển */
export const APPLICATION_SOURCES = ['viecpro', 'recommended', 'zalo', 'consultant', 'hotline', 'referral', 'job_fair', 'social', 'other'] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

/** Nguồn NTD được chọn khi tự thêm ứng viên */
export const MANUAL_APPLICATION_SOURCES = ['hotline', 'referral', 'job_fair', 'social', 'other'] as const;
export type ManualApplicationSource = (typeof MANUAL_APPLICATION_SOURCES)[number];

/** Loại lịch hẹn */
export const INTERVIEW_KINDS = ['online', 'onsite', 'skill_test'] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_STATUSES = ['scheduled', 'done', 'cancelled'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** Trạng thái ứng viên trong một lịch hẹn */
export const ATTENDEE_STATUSES = ['pending', 'confirmed', 'declined', 'attended', 'no_show'] as const;
export type AttendeeStatus = (typeof ATTENDEE_STATUSES)[number];

/** Nền tảng họp online */
export const MEETING_PLATFORMS = ['zoom', 'meet', 'zalo'] as const;
export type MeetingPlatform = (typeof MEETING_PLATFORMS)[number];

/** Kênh gửi lời mời */
export const INVITE_CHANNELS = ['zalo', 'sms', 'email'] as const;
export type InviteChannel = (typeof INVITE_CHANNELS)[number];

/** Trình độ tiếng Nhật */
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];

/** Học vấn */
export const EDUCATION_LEVELS = ['thcs', 'thpt', 'trung_cap', 'cao_dang', 'dai_hoc'] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/** Hộ chiếu: đã có / đang làm / chưa có */
export const PASSPORT_STATUSES = ['has', 'processing', 'none'] as const;
export type PassportStatus = (typeof PASSPORT_STATUSES)[number];

/** Tình trạng hôn nhân */
export const MARITAL_STATUSES = ['single', 'married', 'other'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/** Giấy tờ xuất cảnh được theo dõi trên hồ sơ (ViecPro không thu thập CCCD) */
export const SEEKER_DOCUMENT_KEYS = ['photo', 'passport', 'criminal', 'health'] as const;
export type SeekerDocumentKey = (typeof SEEKER_DOCUMENT_KEYS)[number];
/**
 * Ứng viên chỉ tự tải ảnh 4×6 lên. ViecPro không nhận hoặc lưu CCCD, hộ chiếu, lý lịch tư pháp hay giấy khám sức khoẻ.
 */
export const SEEKER_SELF_UPLOAD_DOCUMENTS = ['photo'] as const satisfies readonly SeekerDocumentKey[];

export const SEEKER_DOCUMENT_STATUSES = ['verified', 'uploaded', 'processing', 'missing'] as const;
export type SeekerDocumentStatus = (typeof SEEKER_DOCUMENT_STATUSES)[number];

/** Nhóm trạng thái ở trang quản lý ứng viên của NTD */
export const APPLICANT_STAGES = ['new', 'contacted', 'interview', 'passed', 'rejected'] as const;
export type ApplicantStage = (typeof APPLICANT_STAGES)[number];

/** Tab trang quản lý tin của NTD */
export const EMPLOYER_JOB_TABS = ['visible', 'pending', 'draft', 'expired'] as const;
export type EmployerJobTab = (typeof EMPLOYER_JOB_TABS)[number];

/** Khoảng thời gian trên dashboard NTD (ngày) */
export const EMPLOYER_RANGES = ['7', '14', '30', '90'] as const;
export type EmployerRange = (typeof EMPLOYER_RANGES)[number];

/** Phúc lợi chọn nhanh khi đăng tin */
export const JOB_BENEFITS = ['Hỗ trợ nhà ở', 'Bảo hiểm đầy đủ', 'Thưởng 2 lần / năm', 'Tăng lương hằng năm', 'Hỗ trợ đi lại', 'Hỗ trợ bữa ăn'] as const;
export type JobBenefit = (typeof JOB_BENEFITS)[number];

/** Kênh nhận hồ sơ */
export const JOB_CHANNELS = ['viecpro', 'zalo', 'hotline'] as const;
export type JobChannel = (typeof JOB_CHANNELS)[number];

/** Kiểu câu hỏi sàng lọc */
export const SCREENING_KINDS = ['yes_no', 'choice'] as const;
export type ScreeningKind = (typeof SCREENING_KINDS)[number];

/** Kỹ năng nổi bật chọn nhanh khi NTD thêm ứng viên */
export const APPLICANT_SKILL_TAGS = ['Khéo tay', 'Thị lực tốt', 'Làm ca đêm được', 'Không hình xăm', 'Đã khám SK'] as const;

/** Tab ở trang "Việc đã ứng tuyển" (design 19) */
export const SEEKER_APPLICATION_TABS = ['all', 'processing', 'interview', 'passed', 'closed'] as const;
export type SeekerApplicationTab = (typeof SEEKER_APPLICATION_TABS)[number];

/** Các bước tiến trình hồ sơ ứng viên nhìn thấy */
export const SEEKER_APPLICATION_STEPS = ['submitted', 'viewed', 'interview', 'passed', 'departed'] as const;
export type SeekerApplicationStep = (typeof SEEKER_APPLICATION_STEPS)[number];

/** Sắp xếp "Việc đã lưu" (design 20) */
export const SAVED_JOB_SORTS = ['expiring', 'match', 'salary'] as const;
export type SavedJobSort = (typeof SAVED_JOB_SORTS)[number];

/* ---------------- Quên mật khẩu ---------------- */
/** Kênh nhận mã đặt lại mật khẩu (design 03) */
export const RESET_CHANNELS = ['sms', 'email'] as const;
export type ResetChannel = (typeof RESET_CHANNELS)[number];

/* ---------------- Thông báo việc làm (job alert – design 04) ---------------- */
export const ALERT_FREQUENCIES = ['instant', 'daily', 'weekly'] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_CHANNELS = ['app', 'email', 'sms'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

/** Mỗi người tối đa 10 thông báo việc làm (spec 3.12) */
export const MAX_JOB_ALERTS = 10;

/* ---------------- Cài đặt (design 05) ---------------- */
/** Nhóm thông báo người dùng bật / tắt theo kênh */
export const NOTIFICATION_GROUPS = ['interview', 'profile_view', 'job_match', 'application', 'lead', 'system'] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

/** Kênh nhận thông báo trong Cài đặt (trùng ALERT_CHANNELS) */
export const NOTIFICATION_CHANNELS = ALERT_CHANNELS;
export type NotificationChannel = AlertChannel;

/** Ai được xem số điện thoại: NTD tôi đã ứng tuyển / mọi NTD đã xác minh */
export const PHONE_VISIBILITIES = ['applied', 'verified'] as const;
export type PhoneVisibility = (typeof PHONE_VISIBILITIES)[number];

export const LOCALES = ['vi', 'ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/* ---------------- Báo cáo vi phạm (M18, A-06) ---------------- */
export const REPORT_TARGETS = ['job', 'employer', 'recruiter', 'user'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/** Lý do báo cáo (spec 3.9) */
export const REPORT_REASONS = ['fee', 'wrong_info', 'duplicate', 'fake_photo', 'scam', 'harassment', 'no_response', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

/** Quyết định xử lý: bỏ qua / cảnh cáo / gỡ tin / tạm khoá / khoá vĩnh viễn */
export const REPORT_DECISIONS = ['dismiss', 'warn', 'remove_job', 'suspend', 'ban'] as const;
export type ReportDecision = (typeof REPORT_DECISIONS)[number];

/* ---------------- Admin: danh sách ---------------- */
/** Tab trạng thái ở danh sách ứng viên (design 09) */
export const ADMIN_SEEKER_TABS = ['all', 'seeking', 'interviewing', 'passed', 'locked'] as const;
export type AdminSeekerTab = (typeof ADMIN_SEEKER_TABS)[number];

/** Tab trạng thái ở danh sách nhà tuyển dụng (design 10) */
export const ADMIN_EMPLOYER_TABS = ['all', 'active', 'pending', 'expiring', 'suspended'] as const;
export type AdminEmployerTab = (typeof ADMIN_EMPLOYER_TABS)[number];

export const ADMIN_EMPLOYER_KINDS = ['all', 'company', 'individual'] as const;
export type AdminEmployerKind = (typeof ADMIN_EMPLOYER_KINDS)[number];

/** Tab ở trang xác minh (design 08) */
export const VERIFICATION_TABS = ['pending', 'needs_info', 'approved', 'rejected'] as const;
export type VerificationTab = (typeof VERIFICATION_TABS)[number];

/** Tab ở trang báo cáo vi phạm (design 11) */
export const REPORT_TABS = ['open', 'resolved', 'dismissed'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

/* ---------- Kiểm duyệt tin (design-new 07) ---------- */
/** Chờ duyệt · yêu cầu NTD sửa · đã xử lý (7 ngày) */
export const MODERATION_TABS = ['pending', 'changes', 'done'] as const;
export type ModerationTab = (typeof MODERATION_TABS)[number];

/** Lý do từ chối / yêu cầu sửa mẫu (spec 12.1) */
export const JOB_REJECT_REASONS = [
  'Thiếu chi phí xuất cảnh',
  'Lương không hợp lý',
  'Ảnh không thực tế',
  'Có SĐT / link trong nội dung',
  'Trùng tin đã đăng',
  'Doanh nghiệp chưa xác minh',
  'Thu phí ngoài bảng chi phí',
] as const;

/**
 * Thùng rác khu NTD: dữ liệu xoá mềm nằm ở đây, khôi phục được hoặc xoá vĩnh viễn (gõ xác nhận).
 * Thêm loại dữ liệu mới: thêm vào danh sách này + API /employer/trash/<key>.
 */
/** Số ngày giữ trong Thùng rác trước khi hệ thống tự xoá vĩnh viễn */
export const TRASH_RETENTION_DAYS = 30;

export const TRASH_CATEGORIES = [
  { key: 'jobs', label: 'Tin tuyển dụng đã xoá', path: 'tin-tuyen-dung' },
  { key: 'members', label: 'Thành viên đã xoá', path: 'thanh-vien' },
] as const;

/** NTD chỉ xoá được tin không còn hiển thị: nháp, bị từ chối, đã đóng (tin đang hiển thị phải đóng / tạm ẩn trước) */
export const DELETABLE_JOB_STATUSES = ['draft', 'rejected', 'closed'] as const;
export type TrashCategory = (typeof TRASH_CATEGORIES)[number]['key'];
