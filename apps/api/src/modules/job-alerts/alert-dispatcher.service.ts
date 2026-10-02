import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { maskEmail, WEB_LINKS } from '@viecpro/shared';
import { ENV, type Env } from '../../config/env.js';
import { AssetUrlService } from '../../core/assets/asset-url.service.js';
import { EmailSender } from '../../core/mail/email-sender.js';
import { jobAlertEmail } from '../../core/mail/templates/account.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { resolvePrefs } from '../notifications/notification-prefs.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { criteriaWhere, isDue, parseCriteria } from './alert-criteria.js';

/** Chu kỳ quét: 5 phút → tin duyệt xong được gửi trong ≤ 10 phút với tần suất "ngay khi có" (Phase 6) */
const TICK_MS = 5 * 60_000;
const BATCH = 200;

/**
 * Gửi thông báo việc làm theo tần suất. Gom nhiều tin vào 1 thông báo / 1 email cho mỗi alert.
 * Không dùng thư viện lịch – một vòng setInterval, khoá từng alert bằng cập nhật có điều kiện
 * nên chạy trùng giữa các instance cũng không gửi 2 lần.
 */
@Injectable()
export class AlertDispatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: EmailSender,
    private readonly assets: AssetUrlService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.JOB_ALERT_WORKER || this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.run(new Date());
      if (sent) this.logger.log(`Đã gửi ${sent} thông báo việc làm`);
    } catch (e) {
      this.logger.error(`Vòng gửi thông báo việc làm lỗi: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Một vòng quét – trả số alert đã gửi. Public để test / chạy tay */
  async run(now: Date): Promise<number> {
    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      const alerts = await this.prisma.jobAlert.findMany({
        where: { enabled: true, user: { deletedAt: null, lockedAt: null } },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        select: { id: true, userId: true, name: true, criteria: true, channels: true, frequency: true, lastSentAt: true, createdAt: true },
      });
      if (!alerts.length) break;
      cursor = alerts[alerts.length - 1]!.id;
      for (const alert of alerts) {
        if (!isDue(alert, now)) continue;
        if (await this.dispatch(alert, now)) sent++;
      }
      if (alerts.length < BATCH) break;
    }
    return sent;
  }

  private async dispatch(
    alert: { id: string; userId: string; name: string; criteria: unknown; channels: string[]; lastSentAt: Date | null; createdAt: Date },
    now: Date,
  ): Promise<boolean> {
    const since = alert.lastSentAt ?? alert.createdAt;
    // Giữ chỗ: chỉ một tiến trình đổi được lastSentAt từ giá trị cũ
    const claimed = await this.prisma.jobAlert.updateMany({ where: { id: alert.id, lastSentAt: alert.lastSentAt }, data: { lastSentAt: now } });
    if (!claimed.count) return false;

    const where = criteriaWhere(parseCriteria(alert.criteria), since);
    const [total, jobs] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { title: true, slug: true, pref: true, salary: true, imageUrl: true, employer: { select: { name: true } } },
      }),
    ]);
    if (!total) return false;

    const title = `${total} việc mới: ${alert.name}`;
    const link = WEB_LINKS.seekerAlerts;
    if (alert.channels.includes('app')) {
      await this.notifications.notify(alert.userId, 'alert.digest', { title, body: jobs.slice(0, 3).map((j) => j.title).join(' · '), link });
    }
    if (alert.channels.includes('email')) await this.sendEmail(alert.userId, alert.name, total, jobs);
    // TODO(decision): kênh SMS cho thông báo việc làm cần nhà cung cấp SMS brandname (hiện OtpSender chỉ gửi mã) – tạm chưa gửi
    return true;
  }

  private async sendEmail(userId: string, alertName: string, total: number, jobs: Array<{ title: string; slug: string; pref: string; salary: number; imageUrl: string; employer: { name: string } | null }>) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, settings: { select: { notifyPrefs: true } } } });
    // Chỉ gửi tới email đã xác thực và khi người dùng chưa tắt email nhóm "Việc mới phù hợp"
    if (!user?.email || !user.emailVerifiedAt || !resolvePrefs(user.settings?.notifyPrefs).job_match.email) return;
    const base = this.env.WEB_BASE_URL.replace(/\/$/, '');
    const message = jobAlertEmail({
      to: user.email,
      alertName,
      total,
      jobs: jobs.map((j) => ({ title: j.title, pref: j.pref, salary: j.salary, imageUrl: this.assets.url(j.imageUrl), employerName: j.employer?.name, url: `${base}${WEB_LINKS.job(j.slug)}` })),
      manageUrl: `${base}${WEB_LINKS.seekerAlerts}`,
      webBaseUrl: this.env.WEB_BASE_URL,
    });
    // Lỗi dịch vụ email không làm hỏng vòng gửi (RULE-BE.md mục 11)
    await this.mail.send({ to: user.email, ...message }).catch((e: unknown) => this.logger.warn(`Gửi email thông báo việc làm tới ${maskEmail(user.email!)} lỗi: ${String(e)}`));
  }
}
