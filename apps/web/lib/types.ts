// Kiểu liệt kê dùng chung với API và app mobile – định nghĩa gốc ở packages/shared
export type { BadgeKind, JobTag, Program, RegionKey } from '@viecpro/shared';
import type { BadgeKind, JobTag, Program, RegionKey } from '@viecpro/shared';

export interface Poster {
  id: string;
  name: string;
  role: string;
  /** Đường dẫn ảnh đại diện; để trống sẽ hiển thị avatar mặc định */
  photo?: string;
  rating: number;
  city: string;
  /** Trang hồ sơ (nếu có) */
  href?: string;
}

export interface Job {
  id: string;
  slug: string;
  img: string;
  pref: string;
  region: RegionKey;
  program: Program;
  title: string;
  /** Lương cơ bản (yên/tháng) */
  salary: number;
  qty: string;
  age: string;
  views: number;
  saved?: boolean;
  tags: JobTag[];
  badges: BadgeKind[];
  posterId: string;
  posted: string;
}

/** Dữ liệu tối thiểu để mở popup ứng tuyển */
export interface ApplyJob {
  slug: string;
  img: string;
  title: string;
  employer: string;
  salary: number;
  qty: string;
  age: string;
  program: Program;
  pref: string;
  poster: Pick<Poster, 'name' | 'role' | 'photo' | 'rating' | 'href'>;
  /** Đơn đã ngừng tuyển: vẫn xem được nhưng không ứng tuyển */
  closed?: boolean;
}
