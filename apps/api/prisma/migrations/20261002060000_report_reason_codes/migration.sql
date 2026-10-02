-- Báo cáo cũ lưu lý do dạng câu → đổi sang mã REPORT_REASONS (shared) + mức độ + hạn xử lý theo SLA (spec 3.9)
UPDATE "Report" SET "reason" = 'fee' WHERE "reason" ILIKE '%thu phí%' OR "reason" ILIKE '%đặt cọc%';
UPDATE "Report" SET "reason" = 'scam' WHERE "reason" ILIKE '%lừa đảo%' OR "reason" ILIKE '%giả mạo%' OR "reason" ILIKE '%mạo danh%';
UPDATE "Report" SET "reason" = 'duplicate' WHERE "reason" ILIKE '%trùng lặp%' OR "reason" ILIKE '%spam%';
UPDATE "Report" SET "reason" = 'fake_photo' WHERE "reason" ILIKE '%ảnh%';
UPDATE "Report" SET "reason" = 'wrong_info' WHERE "reason" ILIKE '%sai lương%' OR "reason" ILIKE '%sai lệch%' OR "reason" ILIKE '%sai thông tin%';
UPDATE "Report" SET "reason" = 'harassment' WHERE "reason" ILIKE '%quấy rối%' OR "reason" ILIKE '%xúc phạm%';

UPDATE "Report" SET "severity" = CASE "reason"
    WHEN 'fee' THEN 'critical'::"ReportSeverity"
    WHEN 'scam' THEN 'critical'::"ReportSeverity"
    WHEN 'harassment' THEN 'high'::"ReportSeverity"
    WHEN 'wrong_info' THEN 'medium'::"ReportSeverity"
    WHEN 'fake_photo' THEN 'medium'::"ReportSeverity"
    ELSE 'low'::"ReportSeverity"
  END,
  "dueAt" = "createdAt" + CASE "reason"
    WHEN 'fee' THEN interval '2 hours'
    WHEN 'scam' THEN interval '2 hours'
    WHEN 'harassment' THEN interval '8 hours'
    WHEN 'wrong_info' THEN interval '24 hours'
    WHEN 'fake_photo' THEN interval '24 hours'
    ELSE interval '72 hours'
  END;
