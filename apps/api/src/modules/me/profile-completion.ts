/** Trọng số các mục hồ sơ – tổng 100. Mục còn thiếu sinh gợi ý "Thêm … +x%" */
const ITEMS = [
  { key: 'name', label: 'Họ và tên', gain: 8 },
  { key: 'phoneVerified', label: 'Xác thực số điện thoại', gain: 10 },
  { key: 'birthYear', label: 'Năm sinh', gain: 8 },
  { key: 'gender', label: 'Giới tính', gain: 4 },
  { key: 'hometown', label: 'Thêm quê quán', gain: 4 },
  { key: 'programs', label: 'Chọn chương trình quan tâm', gain: 8 },
  { key: 'industries', label: 'Chọn ngành nghề quan tâm', gain: 8 },
  { key: 'prefs', label: 'Chọn tỉnh Nhật Bản quan tâm', gain: 6 },
  { key: 'about', label: 'Viết giới thiệu bản thân', gain: 6 },
  { key: 'avatar', label: 'Thêm ảnh đại diện', gain: 8 },
  { key: 'jlpt', label: 'Thêm chứng chỉ tiếng Nhật', gain: 10 },
  { key: 'video', label: 'Quay video giới thiệu 30 giây', gain: 10 },
  { key: 'email', label: 'Thêm email', gain: 10 },
] as const;

export type CompletionInput = Record<(typeof ITEMS)[number]['key'], boolean>;

export function profileCompletion(input: CompletionInput) {
  let completion = 0;
  const suggestions: Array<{ key: string; label: string; gain: number }> = [];
  for (const item of ITEMS) {
    if (input[item.key]) completion += item.gain;
    else suggestions.push({ key: item.key, label: item.label, gain: item.gain });
  }
  // Gợi ý mục được nhiều % nhất trước
  suggestions.sort((a, b) => b.gain - a.gain);
  return { completion, suggestions };
}
