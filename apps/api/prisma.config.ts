import { defineConfig } from 'prisma/config';

// Prisma 7 không tự đọc .env – nạp bằng Node (>= 20.12)
try {
  process.loadEnvFile();
} catch {
  // Không có file .env: dùng biến môi trường của hệ thống (CI, server)
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
