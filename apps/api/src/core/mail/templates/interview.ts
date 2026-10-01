import type { EmailMessage } from '../email-sender.js';
import { button, C, callout, esc, FONT, layout, safeUrl, spacer, vnTime } from './base.js';

export interface InterviewInviteData {
  to: string;
  fullName: string;
  kind: 'online' | 'onsite' | 'skill_test';
  startAt: Date;
  endAt: Date;
  /** "Zoom", "Google Meet"… (online) */
  platformLabel: string | null;
  /** Online: link gửi trước giờ hẹn; trực tiếp: địa chỉ */
  location: string | null;
  meetingUrl: string | null;
  jobTitle: string;
  employerName: string;
  interviewers: string[];
  partnerName: string | null;
  note: string | null;
  webBaseUrl: string;
  trackPath: string;
}

const KIND_LABEL = { online: 'phỏng vấn online', onsite: 'phỏng vấn trực tiếp', skill_test: 'thi tay nghề' } as const;

function row(label: string, value: string): string {
  return `<tr>
<td width="120" valign="top" style="padding:10px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;color:${C.muted};">${label}</td>
<td valign="top" style="padding:10px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:14px;font-weight:600;line-height:21px;color:${C.ink};">${value}</td>
</tr>`;
}

/** Lời mời phỏng vấn gửi qua email (kênh "Email" ở trang Tạo lịch hẹn) */
export function interviewInviteEmail(d: InterviewInviteData): Omit<EmailMessage, 'to'> {
  const start = vnTime(d.startAt);
  const end = vnTime(d.endAt);
  const given = d.fullName.trim().split(/\s+/).pop() || 'bạn';
  const kind = KIND_LABEL[d.kind];
  const place =
    d.kind === 'online'
      ? `${esc(d.platformLabel ?? 'Online')}${d.meetingUrl ? ` &middot; <a href="${safeUrl(d.meetingUrl)}" style="color:${C.brand};">Vào phòng họp</a>` : '<br><span style="font-weight:500;color:' + C.muted + ';">Link phòng họp gửi qua Zalo / tài khoản viecpro trước giờ hẹn 15 phút</span>'}`
      : esc(d.location ?? 'Cán bộ sẽ gửi địa chỉ qua Zalo');
  const who = [...d.interviewers, ...(d.partnerName ? [`${d.partnerName} (có phiên dịch)`] : [])];
  const body = `
<div style="font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${C.brand};">Lời mời ${kind}</div>
<h1 style="margin:8px 0 0;font-size:24px;line-height:31px;font-weight:800;letter-spacing:-0.4px;color:${C.ink};">Chúc mừng ${esc(given)}, bạn được mời ${kind}!</h1>
<p style="margin:10px 0 0;font-size:15px;line-height:24px;">${esc(d.employerName)} mời bạn tham gia ${kind} cho đơn <b style="color:${C.ink};">${esc(d.jobTitle)}</b>.</p>
${spacer(20)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:16px;background:${C.brandDeep};background-image:linear-gradient(120deg, ${C.ink}, ${C.brandDeep});"><tr>
<td width="86" align="center" valign="middle" style="padding:18px 0 18px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="width:64px;padding:8px 0;border-radius:12px;background:#ffffff;font-family:${FONT};">
<div style="font-size:11px;font-weight:700;color:${C.orange};text-transform:uppercase;">${esc(start.weekday.replace('Thứ ', 'Th '))}</div>
<div style="font-size:26px;font-weight:800;line-height:30px;color:${C.ink};">${esc(start.date.slice(0, 2))}</div>
<div style="font-size:11px;color:${C.muted};">Th${esc(start.date.slice(3, 5))}</div>
</td></tr></table></td>
<td valign="middle" style="padding:18px;font-family:${FONT};color:#ffffff;">
<div style="font-size:22px;font-weight:800;line-height:28px;">${esc(start.time)} – ${esc(end.time)}</div>
<div style="padding-top:4px;font-size:13px;line-height:20px;color:#c7d6ff;">${esc(start.weekday)}, ${esc(start.date)} &middot; giờ Việt Nam</div>
</td>
</tr></table>
${spacer(16)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${row(d.kind === 'online' ? 'Hình thức' : 'Địa điểm', place)}
${who.length ? row('Người phỏng vấn', who.map(esc).join('<br>')) : ''}
${d.note ? row('Ghi chú', esc(d.note)) : ''}
</table>
${spacer(22)}
${button(`${d.webBaseUrl}${d.trackPath}`, 'Xác nhận tham gia')}
<p style="margin:12px 0 0;font-size:13px;line-height:20px;color:${C.muted};">Bận vào giờ này? Bấm nút trên và chọn <b>“Xin dời lịch”</b>, hoặc nhắn trực tiếp cán bộ qua Zalo.</p>
${spacer(20)}
${callout(`<b>Chuẩn bị:</b> ${d.kind === 'online' ? 'thử micro, camera trước 15 phút; ngồi nơi yên tĩnh, đủ sáng' : 'đến sớm 15 phút, mang CCCD và bằng cấp bản gốc'}; tập giới thiệu bản thân bằng tiếng Nhật khoảng 1 phút.`, 'green')}`;
  return {
    subject: `Lời mời ${kind}: ${start.time} ${start.weekday} ${start.date.slice(0, 5)} – ${d.jobTitle}`,
    tag: 'interview-invite',
    html: layout({ preheader: `${start.weekday}, ${start.date} lúc ${start.time} · ${d.employerName}`, body, webBaseUrl: d.webBaseUrl, reason: `Bạn nhận email này vì đã ứng tuyển đơn "${d.jobTitle}" bằng địa chỉ ${d.to}.` }),
    text: [
      `Chào ${given},`,
      `${d.employerName} mời bạn ${kind} cho đơn "${d.jobTitle}".`,
      `Thời gian: ${start.time} – ${end.time}, ${start.weekday} ${start.date} (giờ Việt Nam)`,
      d.kind === 'online' ? `Hình thức: ${d.platformLabel ?? 'Online'}${d.meetingUrl ? ` – ${d.meetingUrl}` : ''}` : `Địa điểm: ${d.location ?? ''}`,
      who.length ? `Người phỏng vấn: ${who.join(', ')}` : '',
      `Xác nhận tham gia: ${d.webBaseUrl}${d.trackPath}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
