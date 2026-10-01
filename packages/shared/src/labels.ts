import type {
  ApplicantStage,
  ApplicationSource,
  ApplicationStatus,
  AttendeeStatus,
  EducationLevel,
  Gender,
  InterviewKind,
  JobGender,
  JobStatus,
  JobVisibility,
  MaritalStatus,
  MeetingPlatform,
  PassportStatus,
  Program,
  RegionKey,
  SeekerDocumentKey,
  SeekerDocumentStatus,
  SavedJobSort,
  SeekerApplicationStep,
  SeekerApplicationTab,
} from './enums.js';

export const PROGRAM_LABEL: Record<Program, string> = {
  tts: 'Thực tập sinh',
  tok: 'Kỹ năng đặc định',
  ks: 'Kỹ sư',
};

export const REGION_LABEL: Record<RegionKey, string> = {
  hkt: 'Hokkaido – Tohoku',
  kanto: 'Kanto',
  chubu: 'Chubu',
  kansai: 'Kansai',
  cs: 'Chugoku – Shikoku',
  kyu: 'Kyushu – Okinawa',
};

export const GENDER_LABEL: Record<Gender, string> = {
  nam: 'Nam',
  nu: 'Nữ',
};

export const JOB_GENDER_LABEL: Record<JobGender, string> = {
  nam: 'Nam',
  nu: 'Nữ',
  both: 'Nam và nữ',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Đã gửi',
  viewed: 'Cán bộ đã xem',
  interview: 'Hẹn phỏng vấn',
  passed: 'Trúng tuyển',
  departed: 'Đã xuất cảnh',
  rejected: 'Chưa phù hợp',
  withdrawn: 'Đã rút hồ sơ',
};

/** Nhãn bước hồ sơ phía nhà tuyển dụng */
export const APPLICANT_STAGE_LABEL: Record<ApplicantStage, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  interview: 'Phỏng vấn',
  passed: 'Trúng tuyển',
  rejected: 'Không phù hợp',
};

/** Trạng thái hồ sơ → bước hiển thị cho NTD */
export const STAGE_OF_STATUS: Record<ApplicationStatus, ApplicantStage> = {
  submitted: 'new',
  viewed: 'contacted',
  interview: 'interview',
  passed: 'passed',
  departed: 'passed',
  rejected: 'rejected',
  withdrawn: 'rejected',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  draft: 'Bản nháp',
  pending: 'Chờ duyệt',
  open: 'Đang hiển thị',
  paused: 'Tạm ẩn',
  rejected: 'Bị từ chối',
  closed: 'Hết hạn',
};

export const JOB_VISIBILITY_LABEL: Record<JobVisibility, string> = {
  standard: 'Tiêu chuẩn',
  featured: 'Nổi bật',
  urgent: 'Tuyển gấp',
};

export const APPLICATION_SOURCE_LABEL: Record<ApplicationSource, string> = {
  viecpro: 'Tìm kiếm trên viecpro',
  recommended: 'Gợi ý việc làm phù hợp',
  zalo: 'Chia sẻ qua Zalo',
  consultant: 'Tư vấn viên giới thiệu',
  hotline: 'Gọi hotline',
  referral: 'Người quen giới thiệu',
  job_fair: 'Ngày hội việc làm',
  social: 'Facebook / TikTok',
  other: 'Khác',
};

export const INTERVIEW_KIND_LABEL: Record<InterviewKind, string> = {
  online: 'Online',
  onsite: 'Trực tiếp',
  skill_test: 'Thi tay nghề',
};

export const ATTENDEE_STATUS_LABEL: Record<AttendeeStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  declined: 'Xin đổi giờ',
  attended: 'Đã tham gia',
  no_show: 'Vắng mặt',
};

export const MEETING_PLATFORM_LABEL: Record<MeetingPlatform, string> = {
  zoom: 'Zoom',
  meet: 'Google Meet',
  zalo: 'Zalo video',
};

export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  thcs: 'Tốt nghiệp THCS',
  thpt: 'Tốt nghiệp THPT',
  trung_cap: 'Trung cấp',
  cao_dang: 'Cao đẳng',
  dai_hoc: 'Đại học',
};

export const PASSPORT_LABEL: Record<PassportStatus, string> = {
  has: 'Đã có',
  processing: 'Đang làm',
  none: 'Chưa có',
};

export const MARITAL_LABEL: Record<MaritalStatus, string> = {
  single: 'Độc thân',
  married: 'Đã kết hôn',
  other: 'Khác',
};

export const SEEKER_DOCUMENT_LABEL: Record<SeekerDocumentKey, string> = {
  cccd: 'CCCD',
  photo: 'Ảnh 4×6',
  passport: 'Hộ chiếu',
  criminal: 'Lý lịch tư pháp',
  health: 'Giấy khám sức khoẻ',
};

export const SEEKER_DOCUMENT_STATUS_LABEL: Record<SeekerDocumentStatus, string> = {
  verified: 'Đã xác minh',
  uploaded: 'Đã tải lên',
  processing: 'Đang làm',
  missing: 'Tải lên ngay',
};

/** Có thể xuất cảnh trong (tháng) */
export const DEPART_WITHIN_LABEL: Record<string, string> = {
  '3': 'Trong 3 tháng',
  '6': 'Trong 3 – 6 tháng',
  '12': 'Trong 6 – 12 tháng',
};

/** Trạng thái hồ sơ theo góc nhìn ứng viên (design 19) */
export const SEEKER_APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Đã gửi',
  viewed: 'Cán bộ đã xem',
  interview: 'Hẹn phỏng vấn',
  passed: 'Trúng tuyển',
  departed: 'Đã xuất cảnh',
  rejected: 'Không phù hợp',
  withdrawn: 'Đã rút',
};

export const SEEKER_APPLICATION_STEP_LABEL: Record<SeekerApplicationStep, string> = {
  submitted: 'Đã gửi',
  viewed: 'Cán bộ xem',
  interview: 'Phỏng vấn',
  passed: 'Trúng tuyển',
  departed: 'Xuất cảnh',
};

export const SEEKER_APPLICATION_TAB_LABEL: Record<SeekerApplicationTab, string> = {
  all: 'Tất cả',
  processing: 'Đang xử lý',
  interview: 'Phỏng vấn',
  passed: 'Trúng tuyển',
  closed: 'Đã đóng',
};

export const SAVED_JOB_SORT_LABEL: Record<SavedJobSort, string> = {
  expiring: 'Sắp hết hạn',
  match: 'Phù hợp nhất',
  salary: 'Lương cao',
};
