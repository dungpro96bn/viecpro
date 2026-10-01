/**
 * Khung email viecpro. Email phải dùng bảng + style inline vì Gmail / Outlook bỏ thẻ <style> và CSS ngoài
 * (khác web app – quy tắc "không inline style" của RULE-FE chỉ áp dụng cho apps/web).
 * Mọi dữ liệu động đi qua esc() / safeUrl() trước khi ghép vào HTML.
 */

export const C = {
  brand: '#3879ff',
  brandDeep: '#1b3fa8',
  ink: '#0f2538',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  soft: '#f3f7ff',
  page: '#eef2f8',
  accentSoft: '#ebf2ff',
  green: '#16a34a',
  greenSoft: '#f0fdf4',
  orange: '#c2410c',
  orangeSoft: '#fff7ed',
} as const;

export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Chống chèn HTML từ dữ liệu người dùng (tên, tên đơn, ghi chú…) */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

/** Chỉ nhận link http(s); còn lại trả '#' (chặn javascript:, data:…) */
export function safeUrl(url: string | null | undefined): string {
  return url && /^https?:\/\//i.test(url) ? esc(url) : '#';
}

const VN_TZ = 'Asia/Ho_Chi_Minh';
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Giờ Việt Nam bất kể múi giờ máy chủ: { time: "10:00", date: "01/10/2026", weekday: "Thứ Năm" } */
export function vnTime(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday!);
  return { time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`, date: `${parts.day}/${parts.month}/${parts.year}`, weekday: WEEKDAY[weekdayIndex]! };
}

export const yen = (n: number) => `${n.toLocaleString('vi-VN')} ¥`;

/** Nút bấm chống vỡ trên Outlook (bảng + nền) */
export function button(href: string, label: string, tone: 'primary' | 'light' = 'primary'): string {
  const bg = tone === 'primary' ? C.brand : C.accentSoft;
  const fg = tone === 'primary' ? '#ffffff' : C.brand;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td align="center" bgcolor="${bg}" style="border-radius:12px;background:${bg};">
<a href="${safeUrl(href)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:700;line-height:20px;color:${fg};text-decoration:none;border-radius:12px;">${esc(label)}</a>
</td></tr></table>`;
}

export interface JobCardData {
  title: string;
  pref: string;
  salary: number;
  imageUrl: string;
  employerName?: string | null;
}

/** Thẻ đơn hàng: ảnh + tên + nơi làm + lương */
export function jobCard(job: JobCardData): string {
  const meta = [job.employerName, `${job.pref}, Nhật Bản`].filter(Boolean).map(esc).join(' &middot; ');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:14px;border-collapse:separate;">
<tr>
<td width="84" valign="top" style="padding:14px 0 14px 14px;"><img src="${safeUrl(job.imageUrl)}" width="70" height="70" alt="" style="display:block;width:70px;height:70px;border-radius:10px;object-fit:cover;border:0;"></td>
<td valign="top" style="padding:14px 16px 14px 12px;font-family:${FONT};">
<div style="font-size:15px;font-weight:700;line-height:21px;color:${C.ink};">${esc(job.title)}</div>
<div style="padding-top:4px;font-size:12px;line-height:18px;color:${C.muted};">${meta}</div>
<div style="padding-top:6px;font-size:14px;font-weight:800;color:${C.brand};">${esc(yen(job.salary))}<span style="font-size:12px;font-weight:500;color:${C.muted};">/tháng</span></div>
</td>
</tr>
</table>`;
}

/** Hộp ghi chú màu (cảnh báo bảo mật, mẹo…) */
export function callout(html: string, tone: 'orange' | 'green' | 'blue' = 'blue'): string {
  const map = { orange: [C.orangeSoft, C.orange], green: [C.greenSoft, '#166534'], blue: [C.soft, C.brandDeep] } as const;
  const [bg, fg] = map[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:14px 16px;background:${bg};border-radius:12px;font-family:${FONT};font-size:13px;line-height:20px;color:${fg};">${html}</td></tr></table>`;
}

export const spacer = (h: number) => `<div style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</div>`;

export interface LayoutOptions {
  /** Dòng xem trước hiện ở hộp thư (ẩn trong nội dung) */
  preheader: string;
  /** Dải màu đầu thẻ: brand (mặc định) | green */
  accent?: 'brand' | 'green';
  body: string;
  webBaseUrl: string;
  /** Lý do người nhận nhận email này */
  reason: string;
}

/** Khung chung: logo, thẻ nội dung trắng, chân trang hỗ trợ */
export function layout({ preheader, accent = 'brand', body, webBaseUrl, reason }: LayoutOptions): string {
  const bar = accent === 'green' ? `linear-gradient(90deg, ${C.green}, #22c55e)` : `linear-gradient(90deg, ${C.brand}, ${C.brandDeep})`;
  const barSolid = accent === 'green' ? C.green : C.brand;
  return `<!doctype html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>viecpro</title>
<style>
  /* Chỉ dùng cho màn hình nhỏ – trình đọc email không hỗ trợ thì giữ bố cục mặc định */
  @media only screen and (max-width: 480px) {
    .content { padding: 24px 20px 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 18px;">
<a href="${safeUrl(webBaseUrl)}" target="_blank" style="text-decoration:none;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="34" height="34" align="center" valign="middle" bgcolor="${C.brand}" style="width:34px;height:34px;border-radius:10px;background:${C.brand};font-family:${FONT};font-size:18px;font-weight:900;color:#ffffff;line-height:34px;">&#10003;</td>
<td style="padding-left:10px;font-family:${FONT};font-size:21px;font-weight:800;letter-spacing:-0.5px;color:${C.ink};">Viec<span style="color:${C.brand};">Pro</span></td>
</tr></table>
</a>
</td></tr>
<tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(15,37,56,0.06);">
<div style="height:5px;line-height:5px;font-size:1px;background:${barSolid};background-image:${bar};">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="content" style="padding:32px 32px 30px;font-family:${FONT};color:${C.body};">
${body}
</td></tr></table>
</td></tr>
<tr><td style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted};text-align:center;">
Cần hỗ trợ? Gọi <a href="tel:19006688" style="color:${C.brand};font-weight:700;text-decoration:none;">1900 66 88</a> (Thứ 2 – Thứ 7, 8:00 – 17:30) hoặc gửi email tới <a href="mailto:hotro@viecpro.vn" style="color:${C.brand};text-decoration:none;">hotro@viecpro.vn</a>
</td></tr>
<tr><td style="padding:10px 12px 0;font-family:${FONT};font-size:11px;line-height:17px;color:${C.faint};text-align:center;">
${esc(reason)}<br>viecpro &middot; Số 21 Lê Đức Thọ, Từ Liêm, Hà Nội &middot; Email tự động, vui lòng không trả lời.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
