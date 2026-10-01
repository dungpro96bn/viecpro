import type { DashboardInsight } from '@viecpro/shared';

export interface InsightInput {
  pending: number;
  /** Tin chờ duyệt còn dưới 30 phút tới hạn SLA (hoặc đã quá hạn) */
  nearSla: number;
  submittedLast24h: number;
  submittedPrev24h: number;
  topReport: { reason: string; employers: number; hiddenJobs: number } | null;
  topIndustry: { industry: string; growth: number } | null;
}

const fmt = (n: number) => n.toLocaleString('vi-VN');

/** "3 điều cần chú ý" – sinh từ số liệu thật bằng luật, luôn trả đúng 3 mục */
export function buildInsights(i: InsightInput): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  const growth = i.submittedPrev24h ? Math.round(((i.submittedLast24h - i.submittedPrev24h) / i.submittedPrev24h) * 100) : null;
  if (i.pending === 0) {
    insights.push({ tone: 'success', title: 'Hàng chờ đã trống', body: 'Không còn tin nào chờ duyệt. Kiểm duyệt viên có thể chuyển sang xử lý báo cáo.', action: { label: 'Xem báo cáo', href: '/bao-cao-vi-pham' } });
  } else {
    const title = growth !== null && growth > 0 ? `Hàng chờ tăng ${growth}%` : `${fmt(i.pending)} tin chờ duyệt`;
    const sla = i.nearSla ? `, ${fmt(i.nearSla)} tin sắp quá SLA 2 giờ` : '';
    const advice = i.nearSla >= 3 ? ' Đề xuất thêm 1 kiểm duyệt viên.' : '';
    insights.push({ tone: i.nearSla ? 'warning' : 'success', title, body: `${fmt(i.pending)} tin chờ duyệt${sla}.${advice}`, action: { label: 'Mở hàng chờ', href: '/kiem-duyet-tin' } });
  }

  if (i.topReport) {
    const { reason, employers, hiddenJobs } = i.topReport;
    insights.push({
      tone: 'danger',
      title: `${employers} DN bị báo "${reason.toLowerCase()}"`,
      body: hiddenJobs ? `Có ${hiddenJobs} tin liên quan đang chờ xử lý.` : 'Cần kiểm tra và liên hệ doanh nghiệp.',
      action: { label: 'Mở điều tra', href: '/bao-cao-vi-pham' },
    });
  } else {
    insights.push({ tone: 'success', title: 'Không có báo cáo mới', body: 'Chưa có báo cáo vi phạm nào cần xử lý.', action: { label: 'Xem lịch sử', href: '/bao-cao-vi-pham' } });
  }

  if (i.topIndustry && i.topIndustry.growth > 0) {
    insights.push({
      tone: 'success',
      title: `${i.topIndustry.industry} tăng mạnh`,
      body: `Hồ sơ ứng tuyển ngành ${i.topIndustry.industry} +${i.topIndustry.growth}% tuần này. Cân nhắc gợi ý NTD đăng thêm tin.`,
      action: { label: 'Gửi gợi ý cho NTD', href: '/nha-tuyen-dung' },
    });
  } else {
    insights.push({ tone: 'warning', title: 'Ứng tuyển chưa tăng', body: 'Chưa ngành nào tăng hồ sơ so với tuần trước.', action: { label: 'Xem phân tích', href: '/phan-tich' } });
  }

  return insights;
}

/** Giá trị nguy hiểm khi mở CSV bằng Excel (công thức) – thêm dấu ' phía trước */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
