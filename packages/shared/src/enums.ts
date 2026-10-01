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
export const OTP_PURPOSES = ['register', 'login', 'reset_password'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Mục đích OTP gửi qua email (khớp enum EmailOtpPurpose của Prisma) */
export const EMAIL_OTP_PURPOSES = ['apply'] as const;
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

/** Trạng thái báo cáo vi phạm */
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
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

/** Giấy tờ xuất cảnh của ứng viên */
export const SEEKER_DOCUMENT_KEYS = ['cccd', 'photo', 'passport', 'criminal', 'health'] as const;
export type SeekerDocumentKey = (typeof SEEKER_DOCUMENT_KEYS)[number];
/**
 * Giấy tờ ứng viên tự tải lên được. CCCD, hộ chiếu, lý lịch tư pháp, khám sức khoẻ là dữ liệu nhạy cảm:
 * chỉ nhận khi có kho riêng mã hoá + link ký có hạn (RULE-BE.md mục 8) – hiện gửi bản gốc cho cán bộ tư vấn.
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
export const EMPLOYER_RANGES = ['7', '14', '30'] as const;
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
