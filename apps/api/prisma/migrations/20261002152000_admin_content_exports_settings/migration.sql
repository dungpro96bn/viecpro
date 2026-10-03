CREATE TABLE "SystemSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AdminExportToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "dataset" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "AdminExportToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminExportToken_tokenHash_key" ON "AdminExportToken"("tokenHash");
CREATE INDEX "AdminExportToken_expiresAt_idx" ON "AdminExportToken"("expiresAt");
CREATE INDEX "AdminExportToken_adminId_createdAt_idx" ON "AdminExportToken"("adminId", "createdAt");

INSERT INTO "SystemSetting" ("key", "value", "updatedAt") VALUES
('system', '{"supportPhone":"19006688","supportEmail":"hotro@viecpro.vn","maintenanceMode":false,"maintenanceMessage":"ViecPro đang bảo trì. Vui lòng quay lại sau."}'::jsonb, CURRENT_TIMESTAMP),
('homepage', '{"employerBanner":{"enabled":true,"image":"/images/ads/employer-ad.jpg","tag":"Dành cho nhà tuyển dụng","title":"Đăng đơn hàng Nhật, tiếp cận ứng viên đã sàng lọc","description":"Hồ sơ xí nghiệp được xác minh, hiển thị nổi bật trên toàn hệ thống.","cta":"Đăng tin ngay","href":"/dang-ky"},"courseBanner":{"enabled":true,"image":"/images/ads/japanese-course.jpg","tag":"Khóa tiếng Nhật trước xuất cảnh","title":"Luyện N5 – N4 cùng giáo viên bản ngữ","description":"","cta":"Đăng ký tư vấn","href":"/tim-kiem"},"miniAdsTitle":"Dịch vụ hỗ trợ xuất cảnh","miniAds":[{"id":"lang","enabled":true,"image":"/images/banners/banner-1.jpg","tag":"Tiếng Nhật","title":"Khóa N5 – N4 cấp tốc, học thử miễn phí","cta":"Đăng ký học thử","href":"/tim-kiem"},{"id":"health","enabled":true,"image":"/images/banners/banner-2.jpg","tag":"Sức khỏe","title":"Khám sức khỏe XKLĐ, có kết quả trong ngày","cta":"Đặt lịch khám","href":"/tim-kiem"},{"id":"flight","enabled":true,"image":"/images/banners/banner-3.jpg","tag":"Vé máy bay","title":"Vé Hà Nội – Tokyo ưu đãi cho lao động","cta":"Xem giá vé","href":"/tim-kiem"},{"id":"guide","enabled":true,"image":"/images/banners/banner-4.jpg","tag":"Cẩm nang","title":"Sổ tay sống & làm việc tại Nhật Bản","cta":"Tải miễn phí","href":"/tim-kiem"}]}'::jsonb, CURRENT_TIMESTAMP);
