import { SecretBox } from './secret-box.js';

describe('SecretBox', () => {
  const box = new SecretBox('test-secret-at-least-32-characters-long!!');

  it('mã hoá rồi giải mã ra đúng chuỗi gốc, mỗi lần một bản mã khác', () => {
    const a = box.encrypt('JBSWY3DPEHPK3PXP');
    const b = box.encrypt('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(box.decrypt(a)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('phát hiện bản mã bị sửa', () => {
    const parts = box.encrypt('secret').split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => box.decrypt(parts.join('.'))).toThrow();
  });

  it('khoá khác không giải mã được', () => {
    const other = new SecretBox('another-secret-at-least-32-characters!!');
    expect(() => other.decrypt(box.encrypt('secret'))).toThrow();
  });
});
