type DocumentRow = { key: string; label: string; ok: boolean };

/** Đọc danh sách giấy tờ từ JSON (bỏ phần tử sai dạng) */
export function parseDocuments(raw: unknown): DocumentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d) => {
      const key = typeof d.key === 'string' ? d.key : '';
      return { key, label: typeof d.label === 'string' ? d.label : key, ok: d.ok === true };
    });
}

/**
 * Đối chiếu tự động (design 08): điểm theo tỉ lệ giấy tờ hợp lệ, cộng điểm khi có mã số thuế / SĐT đã xác thực.
 * Nhãn: "Tất cả khớp" hoặc "<giấy tờ lỗi đầu tiên> – lỗi (+n)".
 */
export function autoCheck(docs: DocumentRow[], extras: { hasId: boolean }): { score: number; summary: string; valid: number } {
  const valid = docs.filter((d) => d.ok).length;
  const ratio = docs.length ? valid / docs.length : 0;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 85 + (extras.hasId ? 12 : 0) + (docs.length ? 3 : 0))));
  const failed = docs.filter((d) => !d.ok);
  const summary = !docs.length ? 'Chưa nộp giấy tờ' : failed.length ? `${failed[0]!.label} – lỗi${failed.length > 1 ? ` (+${failed.length - 1})` : ''}` : 'Tất cả khớp';
  return { score, summary, valid };
}

/** Điểm thấp hơn ngưỡng này → "Nghi vấn" */
export const SUSPICIOUS_SCORE = 50;
