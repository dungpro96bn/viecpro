import { z } from 'zod';

/** Biến môi trường – kiểm tra ngay khi khởi động, thiếu / sai là dừng app */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  /** Origin web + admin được gọi API */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3100,http://localhost:3001')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  ASSET_BASE_URL: z.url().default('http://localhost:3100'),
  /** local = lưu tệp vào LOCAL_STORAGE_DIR trên máy chạy API (dev) · s3 = S3 / R2 qua presigned URL */
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  /** Thư mục lưu tệp khi STORAGE_PROVIDER=local (tương đối với thư mục chạy API) */
  LOCAL_STORAGE_DIR: z.string().trim().min(1).default('storage'),
  /** URL gốc trình duyệt gọi tới API – dùng cho link tải lên / xem tệp lưu cục bộ */
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('ap-southeast-1'),
  S3_ENDPOINT: z.url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url().optional(),
  PAYMENT_PROVIDER: z.enum(['mock', 'payos']).default('mock'),
  PAYMENT_MOCK_SECRET: z.string().min(32).default('local-payment-mock-secret-change-me-32'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET cần tối thiểu 32 ký tự'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_SECRET: z.string().min(32, 'OTP_SECRET cần tối thiểu 32 ký tự'),
  OTP_PROVIDER: z.enum(['console', 'zalo', 'sms']).default('console'),
  SMS_TWILIO_ACCOUNT_SID: z.string().optional(),
  SMS_TWILIO_AUTH_TOKEN: z.string().optional(),
  SMS_TWILIO_FROM: z.string().optional(),
  /** console = ghi email ra tệp HTML trong tmp/mail (dev) · resend = gửi thật qua Resend API */
  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  /** Người gửi, vd. "viecpro <no-reply@viecpro.vn>" (tên miền đã xác minh ở nhà cung cấp) */
  EMAIL_FROM: z.string().trim().default('viecpro <no-reply@viecpro.vn>'),
  /** URL trang web dùng cho link trong email */
  WEB_BASE_URL: z.url().default('http://localhost:3100'),
  PUSH_PROVIDER: z.enum(['log', 'fcm']).default('log'),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.email().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  /** Khoá mã hoá bí mật 2FA của admin (AES-256-GCM) */
  ADMIN_MFA_KEY: z.string().min(32, 'ADMIN_MFA_KEY cần tối thiểu 32 ký tự'),
  /** Bỏ qua bước 2FA tạm thời khi kiểm thử cục bộ; production luôn từ chối cờ này */
  ADMIN_MFA_BYPASS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** Danh sách IP được vào API admin (cách nhau dấu phẩy). Để trống = không giới hạn */
  ADMIN_IP_ALLOWLIST: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  GOOGLE_CLIENT_ID: z.string().optional(),

  /** Worker gửi thông báo việc làm (5 phút / lần). Khi chạy nhiều instance chỉ bật ở 1 instance */
  JOB_ALERT_WORKER: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

  APP_MIN_VERSION_IOS: z.string().default('1.0.0'),
  APP_MIN_VERSION_ANDROID: z.string().default('1.0.0'),
  APP_LATEST_VERSION_IOS: z.string().default('1.0.0'),
  APP_LATEST_VERSION_ANDROID: z.string().default('1.0.0'),
  APP_STORE_URL_IOS: z.string().default(''),
  APP_STORE_URL_ANDROID: z.string().default(''),
}).superRefine((env, ctx) => {
  if (env.OTP_PROVIDER === 'sms' && (!env.SMS_TWILIO_ACCOUNT_SID || !env.SMS_TWILIO_AUTH_TOKEN || !env.SMS_TWILIO_FROM)) {
    ctx.addIssue({ code: 'custom', message: 'SMS_TWILIO_ACCOUNT_SID, SMS_TWILIO_AUTH_TOKEN và SMS_TWILIO_FROM bắt buộc khi OTP_PROVIDER=sms' });
  }
  if (env.OTP_PROVIDER === 'zalo') ctx.addIssue({ code: 'custom', message: 'OTP_PROVIDER=zalo chưa được tích hợp; dùng sms hoặc console' });
  if (env.PUSH_PROVIDER === 'fcm' && (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY)) {
    ctx.addIssue({ code: 'custom', message: 'FCM_PROJECT_ID, FCM_CLIENT_EMAIL và FCM_PRIVATE_KEY bắt buộc khi PUSH_PROVIDER=fcm' });
  }
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) ctx.addIssue({ code: 'custom', message: 'RESEND_API_KEY bắt buộc khi EMAIL_PROVIDER=resend' });
  if (env.STORAGE_PROVIDER === 's3' && !env.S3_BUCKET) ctx.addIssue({ code: 'custom', message: 'S3_BUCKET bắt buộc khi STORAGE_PROVIDER=s3' });
});

export type Env = z.infer<typeof envSchema>;

/** Token inject cấu hình: constructor(@Inject(ENV) private env: Env) */
export const ENV = Symbol('ENV');

/** Cấu hình không được phép khi chạy production (RULE-BE.md mục 13) */
export function productionProblems(env: Env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  for (const key of ['JWT_SECRET', 'OTP_SECRET', 'ADMIN_MFA_KEY'] as const) {
    if (/change-me/i.test(env[key])) problems.push(`${key}: còn giá trị mẫu, hãy tạo chuỗi ngẫu nhiên mới`);
  }
  if (new Set([env.JWT_SECRET, env.OTP_SECRET, env.ADMIN_MFA_KEY]).size < 3) problems.push('JWT_SECRET, OTP_SECRET, ADMIN_MFA_KEY phải khác nhau');
  if (env.OTP_PROVIDER === 'console') problems.push('OTP_PROVIDER=console chỉ dùng cho dev');
  if (env.PAYMENT_PROVIDER === 'mock') problems.push('PAYMENT_PROVIDER=mock chỉ dùng cho dev');
  if (env.EMAIL_PROVIDER === 'console') problems.push('EMAIL_PROVIDER=console chỉ dùng cho dev (mã OTP email sẽ không tới người dùng)');
  if (env.STORAGE_PROVIDER === 'local') problems.push('STORAGE_PROVIDER=local chỉ dùng cho dev, production dùng s3');
  if (!env.WEB_BASE_URL.startsWith('https://')) problems.push('WEB_BASE_URL phải dùng https');
  if (env.ADMIN_MFA_BYPASS) problems.push('ADMIN_MFA_BYPASS chỉ được dùng khi phát triển hoặc kiểm thử');
  if (env.CORS_ORIGINS.some((o) => /localhost|127\.0\.0\.1/.test(o))) problems.push('CORS_ORIGINS không được chứa localhost');
  if (env.CORS_ORIGINS.some((o) => !o.startsWith('https://'))) problems.push('CORS_ORIGINS phải dùng https');
  return problems;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Dòng để trống trong .env (vd. "S3_ENDPOINT=") nghĩa là chưa cấu hình, không phải giá trị rỗng
  const parsed = envSchema.safeParse(Object.fromEntries(Object.entries(source).filter(([, value]) => value !== '')));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${lines}`);
  }
  const problems = productionProblems(parsed.data);
  if (problems.length) throw new Error(`Cấu hình không an toàn cho production:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  return parsed.data;
}
