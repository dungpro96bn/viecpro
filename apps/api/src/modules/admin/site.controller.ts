import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/auth/auth.decorators.js';
import { AdminToolsService } from './admin-tools.service.js';

@ApiTags('Trang chủ')
@Public()
@Controller('site')
export class SiteController {
  constructor(private readonly tools: AdminToolsService) {}

  @Get('homepage')
  @ApiOperation({ summary: 'Nội dung banner và quảng cáo trang chủ' })
  homepage() {
    return this.tools.getHomepageContent();
  }

  @Get('system')
  @ApiOperation({ summary: 'Trạng thái bảo trì và thông tin hỗ trợ công khai' })
  async system() {
    const settings = await this.tools.getSystemSettings();
    return {
      supportPhone: settings.supportPhone,
      supportEmail: settings.supportEmail,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    };
  }
}
