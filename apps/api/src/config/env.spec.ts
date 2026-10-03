import { loadEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_SECRET: 'jwt-secret-random-value-0123456789abcdef',
  OTP_SECRET: 'otp-secret-random-value-0123456789abcdef',
  ADMIN_MFA_KEY: 'mfa-secret-random-value-0123456789abcdef',
  SMS_TWILIO_ACCOUNT_SID: 'twilio-account-sid-test-placeholder',
  SMS_TWILIO_AUTH_TOKEN: 'twilio-secret-test-value',
  SMS_TWILIO_FROM: '+15005550006',
};
/** Cấu hình production hợp lệ tối thiểu */
const prod = { ...base, NODE_ENV: 'production', PAYMENT_PROVIDER: 'payos', OTP_PROVIDER: 'sms', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_key', WEB_BASE_URL: 'https://viecpro.vn', STORAGE_PROVIDER: 's3', S3_BUCKET: 'viecpro-test' };

describe('loadEnv', () => {
  it('dev chấp nhận cấu hình mặc định', () => {
    expect(loadEnv({ ...base, JWT_SECRET: 'change-me-to-a-long-random-string-at-least-32-chars' }).PORT).toBe(4000);
  });

  it('coi biến để trống trong .env là chưa cấu hình', () => {
    const env = loadEnv({ ...base, S3_ENDPOINT: '', REDIS_URL: '', FCM_CLIENT_EMAIL: '', GOOGLE_CLIENT_ID: '' });
    expect(env.S3_ENDPOINT).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('production từ chối secret mẫu, OTP console, CORS localhost', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'change-me-to-a-long-random-string-at-least-32-chars' }),
    ).toThrow(/JWT_SECRET.*giá trị mẫu[\s\S]*OTP_PROVIDER[\s\S]*localhost/);
  });

  it('production hợp lệ khi cấu hình đúng', () => {
    const env = loadEnv({ ...prod, CORS_ORIGINS: 'https://viecpro.vn,https://admin.viecpro.vn' });
    expect(env.CORS_ORIGINS).toEqual(['https://viecpro.vn', 'https://admin.viecpro.vn']);
  });

  it('production từ chối email console / thiếu khoá Resend', () => {
    expect(() => loadEnv({ ...prod, EMAIL_PROVIDER: 'console', CORS_ORIGINS: 'https://viecpro.vn' })).toThrow(/EMAIL_PROVIDER=console/);
    expect(() => loadEnv({ ...prod, RESEND_API_KEY: undefined, CORS_ORIGINS: 'https://viecpro.vn' })).toThrow(/RESEND_API_KEY/);
  });

  it('production từ chối dùng chung một secret', () => {
    expect(() =>
      loadEnv({ ...prod, OTP_SECRET: base.JWT_SECRET, CORS_ORIGINS: 'https://viecpro.vn' }),
    ).toThrow(/phải khác nhau/);
  });

  it('production từ chối lưu tệp cục bộ', () => {
    expect(() => loadEnv({ ...prod, STORAGE_PROVIDER: 'local', CORS_ORIGINS: 'https://viecpro.vn' })).toThrow(/STORAGE_PROVIDER=local/);
  });

  it('production từ chối bỏ qua 2FA', () => {
    expect(() => loadEnv({ ...prod, ADMIN_MFA_BYPASS: 'true', CORS_ORIGINS: 'https://admin.viecpro.vn' })).toThrow(/ADMIN_MFA_BYPASS/);
  });

  it('development cho phép bật cờ bỏ qua 2FA để kiểm thử', () => {
    expect(loadEnv({ ...base, ADMIN_MFA_BYPASS: 'true' }).ADMIN_MFA_BYPASS).toBe(true);
    expect(loadEnv(base).ADMIN_MFA_BYPASS).toBe(false);
  });
});
