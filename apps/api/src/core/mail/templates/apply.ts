import type { EmailMessage } from '../email-sender.js';
import { button, C, callout, esc, FONT, jobCard, layout, safeUrl, spacer, type JobCardData } from './base.js';

/** Lời chào: chỉ lấy tên gọi (từ cuối) – "Nguyễn Thị Lan" → "Lan" */
const givenName = (fullName?: string | null) => fullName?.trim().split(/\s+/).pop() || 'bạn';

export interface ApplyOtpData {
  to: string;
  fullName?: string | null;
  code: string;
  expiresMinutes: number;
  job: JobCardData;
  webBaseUrl: string;
}

/** Mã xác nhận email khi ứng tuyển (6 số, sống 5 phút) */
export function applyOtpEmail(d: ApplyOtpData): Omit<EmailMessage, 'to'> {
  const digits = d.code.split('').map(
    (n) => `<td align="center" valign="middle" width="46" height="56" style="width:46px;height:56px;border:1px solid #c9d8ff;border-radius:12px;background:${C.soft};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:800;color:${C.ink};">${esc(n)}</td><td width="8" style="width:8px;font-size:1px;">&nbsp;</td>`,
  ).join('');
  const body = `
<div style="font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.brand};">Xác nhận ứng tuyển</div>
<h1 style="margin:8px 0 0;font-size:24px;line-height:31px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">Mã xác nhận của bạn</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:24px;">Chào ${esc(givenName(d.fullName))}, bạn vừa ứng tuyển đơn hàng dưới đây trên viecpro. Nhập mã sau vào màn hình ứng tuyển để xác nhận email và gửi hồ sơ:</p>
${spacer(22)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${digits}</tr></table>
<p style="margin:14px 0 0;text-align:center;font-size:13px;line-height:20px;color:${C.muted};">Mã có hiệu lực trong <b style="color:${C.ink};">${d.expiresMinutes} phút</b> và chỉ dùng được một lần.</p>
${spacer(24)}
<div style="padding-bottom:8px;font-size:12px;font-weight:700;color:${C.muted};">ĐƠN BẠN ĐANG ỨNG TUYỂN</div>
${jobCard(d.job)}
${spacer(20)}
${callout(`<b>Không chia sẻ mã này với bất kỳ ai.</b> viecpro và cán bộ tuyển dụng không bao giờ hỏi mã qua điện thoại, Zalo hay Facebook. Nếu bạn không ứng tuyển, hãy bỏ qua email này – hồ sơ sẽ không được gửi.`, 'orange')}`;
  return {
    subject: `${d.code} là mã xác nhận ứng tuyển viecpro`,
    tag: 'apply-otp',
    html: layout({ preheader: `Mã có hiệu lực ${d.expiresMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`, body, webBaseUrl: d.webBaseUrl, reason: `Bạn nhận email này vì địa chỉ ${d.to} được dùng để ứng tuyển trên viecpro.` }),
    text: [
      `Chào ${givenName(d.fullName)},`,
      `Mã xác nhận ứng tuyển viecpro của bạn: ${d.code}`,
      `Mã có hiệu lực ${d.expiresMinutes} phút, chỉ dùng một lần.`,
      `Đơn: ${d.job.title} – ${d.job.pref}, Nhật Bản`,
      'Không chia sẻ mã này với bất kỳ ai. Nếu bạn không ứng tuyển, hãy bỏ qua email.',
      'Hỗ trợ: 1900 66 88 · hotro@viecpro.vn',
    ].join('\n'),
  };
}

export interface ApplicationReceivedData {
  to: string;
  fullName: string;
  /** Mã hồ sơ "VP-58259" */
  code: string;
  job: JobCardData & { slug: string };
  consultant: { name: string; title: string; photoUrl: string | null } | null;
  /** Ứng viên có tài khoản → link "Theo dõi hồ sơ"; khách → link xem lại đơn */
  hasAccount: boolean;
  webBaseUrl: string;
  trackPath: string;
}

const STEPS = [
  ['Cán bộ gọi lại tư vấn', 'Trong khoảng 30 phút (giờ hành chính) để xác nhận thông tin và giải đáp thắc mắc.'],
  ['Hẹn phỏng vấn', 'Online hoặc trực tiếp – bạn nhận lời mời qua Zalo, SMS và email này.'],
  ['Trúng tuyển & làm thủ tục', 'Cán bộ hướng dẫn khám sức khoẻ, giấy tờ và lịch xuất cảnh.'],
] as const;

/** Xác nhận đã nhận hồ sơ (sau khi ứng tuyển thành công) */
export function applicationReceivedEmail(d: ApplicationReceivedData): Omit<EmailMessage, 'to'> {
  const steps = STEPS.map(
    ([title, desc], i) => `<tr>
<td width="40" valign="top" style="padding:0 0 16px;"><div style="width:28px;height:28px;border-radius:50%;background:${i === 0 ? C.brand : C.accentSoft};color:${i === 0 ? '#ffffff' : C.brand};font-family:${FONT};font-size:13px;font-weight:800;line-height:28px;text-align:center;">${i + 1}</div></td>
<td valign="top" style="padding:3px 0 16px;font-family:${FONT};"><div style="font-size:14px;font-weight:700;color:${C.ink};">${title}</div><div style="padding-top:2px;font-size:13px;line-height:20px;color:${C.muted};">${desc}</div></td>
</tr>`,
  ).join('');
  const consultant = d.consultant
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.soft};border-radius:12px;"><tr>
${d.consultant.photoUrl ? `<td width="56" style="padding:14px 0 14px 14px;"><img src="${safeUrl(d.consultant.photoUrl)}" width="42" height="42" alt="" style="display:block;width:42px;height:42px;border-radius:50%;object-fit:cover;"></td>` : ''}
<td style="padding:14px;font-family:${FONT};"><div style="font-size:12px;color:${C.muted};">Cán bộ phụ trách đơn</div><div style="padding-top:2px;font-size:14px;font-weight:700;color:${C.ink};">${esc(d.consultant.name)}</div><div style="font-size:12px;color:${C.muted};">${esc(d.consultant.title)}</div></td>
</tr></table>${spacer(20)}`
    : '';
  const href = `${d.webBaseUrl}${d.hasAccount ? d.trackPath : `/viec-lam/${d.job.slug}`}`;
  const body = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" height="48" align="center" bgcolor="${C.greenSoft}" style="width:48px;height:48px;border-radius:50%;background:${C.greenSoft};font-size:24px;color:${C.green};font-weight:900;line-height:48px;">&#10003;</td></tr></table>
<h1 style="margin:16px 0 0;font-size:24px;line-height:31px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">Đã nhận hồ sơ của bạn!</h1>
<p style="margin:10px 0 0;font-size:15px;line-height:24px;">Chào ${esc(givenName(d.fullName))}, hồ sơ <b style="color:${C.ink};">${esc(d.code)}</b> đã được gửi tới cán bộ tuyển dụng. Hãy để ý điện thoại – cán bộ sẽ sớm liên hệ với bạn.</p>
${spacer(20)}
${jobCard(d.job)}
${spacer(20)}
${consultant}
<div style="padding-bottom:12px;font-size:12px;font-weight:700;color:${C.muted};">CÁC BƯỚC TIẾP THEO</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>
${spacer(4)}
${button(href, d.hasAccount ? 'Theo dõi hồ sơ' : 'Xem lại đơn hàng')}
${spacer(22)}
${callout('<b>Lưu ý:</b> viecpro không thu phí khi đăng ký ứng tuyển. Hãy cẩn trọng với người yêu cầu chuyển tiền đặt cọc để “giữ suất”.', 'blue')}`;
  return {
    subject: `Đã nhận hồ sơ ${d.code}: ${d.job.title}`,
    tag: 'application-received',
    html: layout({ preheader: 'Cán bộ tuyển dụng sẽ gọi lại cho bạn trong khoảng 30 phút (giờ hành chính).', accent: 'green', body, webBaseUrl: d.webBaseUrl, reason: `Bạn nhận email này vì đã ứng tuyển trên viecpro bằng địa chỉ ${d.to}.` }),
    text: [
      `Chào ${givenName(d.fullName)},`,
      `viecpro đã nhận hồ sơ ${d.code} cho đơn "${d.job.title}" (${d.job.pref}, Nhật Bản).`,
      'Cán bộ tuyển dụng sẽ gọi lại cho bạn trong khoảng 30 phút (giờ hành chính).',
      `Theo dõi: ${href}`,
      'viecpro không thu phí khi đăng ký ứng tuyển.',
    ].join('\n'),
  };
}
