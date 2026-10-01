import { describe, expect, it } from 'vitest';
import { maskEmail } from '../../../modules/applications/apply-email-otp.service.js';
import { applicationReceivedEmail, applyOtpEmail } from './apply.js';
import { esc, safeUrl, vnTime } from './base.js';
import { interviewInviteEmail } from './interview.js';

const job = { title: 'Tuyển 25 nữ lắp ráp <b>điện tử</b>', pref: 'Saitama', salary: 176000, imageUrl: 'https://cdn.viecpro.vn/a.jpg', employerName: 'Việt Nam CAMCOM' };

describe('mẫu email', () => {
  it('escape dữ liệu người dùng, chặn link không phải http(s)', () => {
    expect(esc(`<script>"x"&'y'</script>`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('https://viecpro.vn/a?b=1&c=2')).toBe('https://viecpro.vn/a?b=1&amp;c=2');
  });

  it('giờ Việt Nam không phụ thuộc múi giờ máy chủ', () => {
    expect(vnTime(new Date('2026-10-01T03:00:00Z'))).toEqual({ time: '10:00', date: '01/10/2026', weekday: 'Thứ Năm' });
    expect(vnTime(new Date('2026-10-01T17:30:00Z'))).toEqual({ time: '00:30', date: '02/10/2026', weekday: 'Thứ Sáu' });
  });

  it('email mã OTP: mã ở tiêu đề + 6 ô số, tên đơn đã escape, có cảnh báo không chia sẻ', () => {
    const m = applyOtpEmail({ to: 'lan@gmail.com', fullName: 'Nguyễn Thị <i>Lan</i>', code: '482915', expiresMinutes: 5, job, webBaseUrl: 'https://viecpro.vn' });
    expect(m.subject).toBe('482915 là mã xác nhận ứng tuyển viecpro');
    expect(m.html).toContain('&lt;b&gt;điện tử&lt;/b&gt;');
    expect(m.html).not.toContain('<b>điện tử</b>');
    expect(m.html).toContain('&lt;i&gt;Lan&lt;/i&gt;');
    expect(m.html.match(/monospace;font-size:28px/g)).toHaveLength(6);
    expect(m.html).toContain('Không chia sẻ mã này');
    expect(m.text).toContain('482915');
  });

  it('email đã nhận hồ sơ: link theo dõi cho tài khoản, link đơn cho khách', () => {
    const base = { to: 'lan@gmail.com', fullName: 'Lan', code: 'VP-1', job: { ...job, slug: 'don-a' }, consultant: null, webBaseUrl: 'https://viecpro.vn', trackPath: '/tai-khoan-ung-vien/viec-da-ung-tuyen' };
    expect(applicationReceivedEmail({ ...base, hasAccount: true }).html).toContain('https://viecpro.vn/tai-khoan-ung-vien/viec-da-ung-tuyen');
    expect(applicationReceivedEmail({ ...base, hasAccount: false }).html).toContain('https://viecpro.vn/viec-lam/don-a');
  });

  it('email mời phỏng vấn hiện giờ Việt Nam và không lộ link phòng họp', () => {
    const m = interviewInviteEmail({
      to: 'lan@gmail.com', fullName: 'Nguyễn Thị Lan', kind: 'online', startAt: new Date('2026-10-01T03:00:00Z'), endAt: new Date('2026-10-01T04:00:00Z'),
      platformLabel: 'Zoom', location: null, meetingUrl: null, jobTitle: job.title, employerName: 'CAMCOM', interviewers: ['Nguyễn Thu Hà'], partnerName: null, note: null,
      webBaseUrl: 'https://viecpro.vn', trackPath: '/tai-khoan-ung-vien/viec-da-ung-tuyen',
    });
    expect(m.subject).toContain('10:00 Thứ Năm 01/10');
    expect(m.html).toContain('10:00 – 11:00');
    expect(m.html).not.toContain('zoom.us');
  });

  it('che email trong response', () => {
    expect(maskEmail('lan.nguyen99@gmail.com')).toBe('la•••99@gmail.com');
    expect(maskEmail('ab@x.vn')).toBe('a•••@x.vn');
  });
});
