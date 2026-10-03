import { z } from 'zod';

// Thông báo lỗi mặc định của zod bằng tiếng Việt (cho mọi schema không tự ghi message)
z.config(z.locales.vi());

export * from './enums.js';
export * from './labels.js';
export * from './prefectures.js';
export * from './utils.js';
export * from './routes.js';
export * from './contracts.js';
export * from './schemas/common.js';
export * from './schemas/auth.js';
export * from './schemas/jobs.js';
export * from './schemas/uploads.js';
export * from './schemas/engagement.js';
export * from './schemas/account.js';
export * from './schemas/employer-profile.js';
export * from './admin.js';
export * from './schemas/admin.js';
export * from './plans.js';
export * from './schemas/conversations.js';
