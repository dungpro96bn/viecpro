import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { purgeTrashedJob } from './employer-job-trash.service.js';
import { purgeTrashedMember } from './employer-trash.service.js';
import { trashCutoff } from './trash-retention.js';

/** Chu kỳ quét: 1 giờ – mục quá hạn bị xoá chậm nhất ~1 giờ sau mốc 30 ngày */
const TICK_MS = 60 * 60_000;
const BATCH = 100;

/**
 * Tự xoá vĩnh viễn mục đã nằm trong Thùng rác quá TRASH_RETENTION_DAYS ngày.
 * Mỗi mục khoá bằng cập nhật có điều kiện (purgedAt: null) nên chạy trùng giữa các instance cũng chỉ xoá một lần.
 */
@Injectable()
export class TrashPurgeWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TrashPurgeWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const purged = await this.run(new Date());
      if (purged) this.logger.log(`Đã tự xoá vĩnh viễn ${purged} mục quá hạn trong thùng rác`);
    } catch (e) {
      this.logger.error(`Vòng dọn thùng rác lỗi: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Một vòng dọn – trả số mục đã xoá (tin + thành viên). Public để test / chạy tay */
  async run(now: Date): Promise<number> {
    return (await this.runJobs(now)) + (await this.runMembers(now));
  }

  private async runJobs(now: Date): Promise<number> {
    const expired: Prisma.JobWhereInput = { deletedAt: { lte: trashCutoff(now) }, purgedAt: null };
    let purged = 0;
    for (;;) {
      const rows = await this.prisma.job.findMany({ where: expired, orderBy: { deletedAt: 'asc' }, take: BATCH, select: { id: true } });
      for (const row of rows) {
        if (await purgeTrashedJob(this.prisma, row.id, expired, now)) purged++;
      }
      if (rows.length < BATCH) break;
    }
    return purged;
  }

  private async runMembers(now: Date): Promise<number> {
    const expired: Prisma.RecruiterWhereInput = { employerId: { not: null }, leftAt: { lte: trashCutoff(now) }, purgedAt: null };
    let purged = 0;
    for (;;) {
      const rows = await this.prisma.recruiter.findMany({ where: expired, orderBy: { leftAt: 'asc' }, take: BATCH, select: { id: true, userId: true } });
      for (const row of rows) {
        if (await purgeTrashedMember(this.prisma, row, expired, now)) purged++;
      }
      if (rows.length < BATCH) break;
    }
    return purged;
  }
}
