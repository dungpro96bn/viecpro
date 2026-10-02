import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ENV, type Env } from './config/env.js';
import { LOCAL_FILES_ROUTE } from './core/assets/asset-url.service.js';
import { UploadService } from './core/assets/upload.service.js';

// Nạp file .env khi chạy local (production dùng biến môi trường của server)
try {
  process.loadEnvFile();
} catch {
  /* không có .env */
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<Env>(ENV);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

  // Kho tệp cục bộ (dev): ảnh / video tải lên được web, admin, mobile ở origin khác hiển thị
  if (env.STORAGE_PROVIDER === 'local') {
    app.useStaticAssets(app.get(UploadService).localRoot, {
      prefix: LOCAL_FILES_ROUTE,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    });
  }

  // Mọi API dưới /api/v1/... – đổi API không tương thích thì thêm v2, app mobile cũ vẫn chạy
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  // Tài liệu API cho web / mobile: /docs (giao diện), /docs-json (OpenAPI để sinh client)
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('viecpro API')
      .setDescription('API dùng chung cho web Next.js và app mobile. Lỗi luôn có dạng { statusCode, code, message, fields? }.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'docs-json' });
  }

  await app.listen(env.PORT);
  Logger.log(`API chạy tại http://localhost:${env.PORT}/api/v1 · tài liệu: http://localhost:${env.PORT}/docs`, 'Bootstrap');
}

await bootstrap();
