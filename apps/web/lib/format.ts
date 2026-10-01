import type { JobTag } from './types';

export { PROGRAM_LABEL } from '@viecpro/shared';

/** 185000 → "185.000" */
export function formatNumber(n: number): string {
  return n.toLocaleString('vi-VN');
}

/** 185000 → "185.000 ¥" */
export function formatYen(n: number): string {
  return `${formatNumber(n)} ¥`;
}

/** Nối các class, bỏ qua giá trị rỗng */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}


/** Class màu cho từng tag đơn hàng (định nghĩa trong globals.css) */
export const TAG_CLASS: Record<JobTag, string> = {
  'Lương cao': 'chip--luong-cao',
  'Phí thấp': 'chip--phi-thap',
  'Đơn miễn phí': 'chip--mien-phi',
  'Tăng ca nhiều': 'chip--tang-ca',
  'Xuất cảnh nhanh': 'chip--xuat-canh',
  'Bảo lãnh gia đình': 'chip--bao-lanh',
};
