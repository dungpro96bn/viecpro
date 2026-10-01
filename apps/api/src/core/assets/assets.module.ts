import { Global, Module } from '@nestjs/common';
import { AssetUrlService } from './asset-url.service.js';
import { UploadService } from './upload.service.js';

@Global()
@Module({ providers: [AssetUrlService, UploadService], exports: [AssetUrlService, UploadService] })
export class AssetsModule {}
