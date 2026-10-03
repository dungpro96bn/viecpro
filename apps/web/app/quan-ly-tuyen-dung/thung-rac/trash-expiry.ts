const DAY_MS = 86400_000;

/** Số ngày còn lại trước khi hệ thống tự xoá vĩnh viễn (làm tròn lên, tối thiểu 0) */
export function daysLeft(purgeAt: string): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / DAY_MS));
}

export function purgeLabel(purgeAt: string): string {
  const days = daysLeft(purgeAt);
  return days > 0 ? `Tự xoá vĩnh viễn sau ${days} ngày` : 'Sắp tự xoá vĩnh viễn';
}
