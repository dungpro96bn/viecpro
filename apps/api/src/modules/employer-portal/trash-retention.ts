import { TRASH_RETENTION_DAYS } from '@viecpro/shared';

const DAY_MS = 86400_000;

/** Thời điểm mục trong thùng rác bị tự xoá vĩnh viễn */
export function trashPurgeAt(removedAt: Date): Date {
  return new Date(removedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS);
}

/** Mốc xoá: mục nào bị xoá mềm trước thời điểm này đã quá hạn giữ trong thùng rác */
export function trashCutoff(now: Date): Date {
  return new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
}
