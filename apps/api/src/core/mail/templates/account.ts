import type { EmailMessage } from '../email-sender.js';
import { button, C, callout, esc, jobCard, layout, spacer, type JobCardData } from './base.js';

const PURPOSE = {
  reset_password: {
    eyebrow: 'Đặt lại mật khẩu',
    title: 'Mã đặt lại mật khẩu',
    intro: 'Bạn vừa yêu cầu đặt lại mật khẩu tài khoản viecpro. Nhập mã sau để tạo mật khẩu mới:',
    ignore: 'Nếu bạn không yêu cầu, hãy bỏ qua email này – mật khẩu của bạn không thay đổi.',
    subject: 'mã đặt lại mật khẩu viecpro',
  },
  change_email: {
    eyebrow: 'Xác nhận email',
    title: 'Mã xác nhận email mới',
    intro: 'Bạn vừa đổi email đăng nhập viecpro sang địa chỉ này. Nhập mã sau trong trang Cài đặt để xác nhận:',
    ignore: 'Nếu bạn không yêu cầu, hãy bỏ qua email này – email của tài khoản không thay đổi.',
    subject: 'mã xác nhận email viecpro',
  },
} as const;

export interface AccountCodeData {
  to: string;
  purpose: keyof typeof PURPOSE;
  code: string;
  expiresMinutes: number;
  webBaseUrl: string;
}

/** Mã 6 số cho đặt lại mật khẩu / đổi email */
export function accountCodeEmail(d: AccountCodeData): Omit<EmailMessage, 'to'> {
  const p = PURPOSE[d.purpose];
  const digits = d.code
    .split('')
    .map(
      (n) =>
        `<td align="center" valign="middle" width="46" height="56" style="width:46px;height:56px;border:1px solid #c9d8ff;border-radius:12px;background:${C.soft};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:800;color:${C.ink};">${esc(n)}</td><td width="8" style="width:8px;font-size:1px;">&nbsp;</td>`,
    )
    .join('');
  const body = `
<div style="font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.brand};">${esc(p.eyebrow)}</div>
<h1 style="margin:8px 0 0;font-size:24px;line-height:31px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">${esc(p.title)}</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:24px;">${esc(p.intro)}</p>
${spacer(22)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${digits}</tr></table>
<p style="margin:14px 0 0;text-align:center;font-size:13px;line-height:20px;color:${C.muted};">Mã có hiệu lực trong <b style="color:${C.ink};">${d.expiresMinutes} phút</b> và chỉ dùng được một lần.</p>
${spacer(20)}
${callout(`<b>Không chia sẻ mã này với bất kỳ ai.</b> viecpro không bao giờ hỏi mã qua điện thoại, Zalo hay Facebook. ${esc(p.ignore)}`, 'orange')}`;
  return {
    subject: `${d.code} là ${p.subject}`,
    tag: `${d.purpose.replace('_', '-')}-otp`,
    html: layout({ preheader: `Mã có hiệu lực ${d.expiresMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`, body, webBaseUrl: d.webBaseUrl, reason: `Bạn nhận email này vì địa chỉ ${d.to} gắn với một tài khoản viecpro.` }),
    text: [`${p.title}: ${d.code}`, `Mã có hiệu lực ${d.expiresMinutes} phút, chỉ dùng một lần.`, p.ignore, 'Hỗ trợ: 1900 66 88 · hotro@viecpro.vn'].join('\n'),
  };
}

export interface JobAlertEmailData {
  to: string;
  alertName: string;
  total: number;
  jobs: Array<JobCardData & { url: string }>;
  manageUrl: string;
  webBaseUrl: string;
}

/** Thông báo việc làm: gom nhiều việc mới vào 1 email (spec M7) */
export function jobAlertEmail(d: JobAlertEmailData): Omit<EmailMessage, 'to'> {
  const cards = d.jobs.map((j) => `${jobCard(j)}${spacer(12)}`).join('');
  const body = `
<div style="font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.brand};">Thông báo việc làm</div>
<h1 style="margin:8px 0 0;font-size:24px;line-height:31px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">${d.total} việc mới: ${esc(d.alertName)}</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:24px;">Đây là các đơn hàng mới khớp tiêu chí bạn đã lưu trên viecpro.</p>
${spacer(20)}
${cards}
${spacer(8)}
${button(d.manageUrl, 'Xem tất cả & cài đặt')}`;
  return {
    subject: `${d.total} việc mới phù hợp: ${d.alertName}`,
    tag: 'job-alert',
    html: layout({ preheader: `${d.total} đơn hàng Nhật Bản mới khớp "${d.alertName}"`, body, webBaseUrl: d.webBaseUrl, reason: `Bạn nhận email này vì đã bật thông báo việc làm "${d.alertName}". Tắt trong Cài đặt bất cứ lúc nào.` }),
    text: [`${d.total} việc mới: ${d.alertName}`, ...d.jobs.map((j) => `- ${j.title} (${j.pref}): ${j.url}`), `Cài đặt: ${d.manageUrl}`].join('\n'),
  };
}
