import { TRASH_RETENTION_DAYS } from '@viecpro/shared';
import type { Env } from '../../config/env.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { trashCutoff, trashPurgeAt } from './trash-retention.js';
import { TrashPurgeWorker } from './trash-purge.worker.js';

const DAY = 86400_000;

describe('Thùng rác – tự xoá sau 30 ngày', () => {
  const now = new Date('2026-10-03T10:00:00Z');

  it('mốc tự xoá = ngày xoá + 30 ngày, mốc quét = hiện tại − 30 ngày', () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(trashPurgeAt(now).getTime() - now.getTime()).toBe(30 * DAY);
    expect(now.getTime() - trashCutoff(now).getTime()).toBe(30 * DAY);
  });

  it('chỉ ẩn danh thành viên quá hạn, bỏ qua bản ghi đã bị khôi phục giữa chừng', async () => {
    const rows = [
      { id: 'r1', userId: 'u1' },
      { id: 'r2', userId: null },
    ];
    const updateMany = vi.fn(async ({ where }: { where: { id: string } }) => ({ count: where.id === 'r2' ? 0 : 1 }));
    const userUpdate = vi.fn();
    const tx = {
      recruiter: { updateMany },
      follow: { deleteMany: vi.fn() },
      user: { update: userUpdate },
      session: { updateMany: vi.fn() },
      pushToken: { deleteMany: vi.fn() },
    };
    const findMany = vi.fn(async () => rows);
    const prisma = { recruiter: { findMany }, job: { findMany: vi.fn(async () => []) }, $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
    const worker = new TrashPurgeWorker(prisma as unknown as PrismaService, { NODE_ENV: 'test' } as Env);

    expect(await worker.run(now)).toBe(1);
    const where = (findMany.mock.calls[0] as unknown as [{ where: { leftAt: { lte: Date }; purgedAt: null } }])[0].where;
    expect(where.leftAt.lte).toEqual(trashCutoff(now));
    expect(where.purgedAt).toBeNull();
    // Khoá có điều kiện: vẫn phải quá hạn + chưa xoá tại thời điểm cập nhật
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'r1', purgedAt: null, leftAt: { lte: trashCutoff(now) } }) }));
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
  });

  it('tự xoá vĩnh viễn tin quá hạn, giữ bản ghi và bỏ khỏi việc đã lưu', async () => {
    const jobUpdate = vi.fn(async () => ({ count: 1 }));
    const savedDelete = vi.fn();
    const tx = { job: { updateMany: jobUpdate }, savedJob: { deleteMany: savedDelete } };
    const jobFind = vi.fn(async () => [{ id: 'j1' }]);
    const prisma = {
      job: { findMany: jobFind },
      recruiter: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const worker = new TrashPurgeWorker(prisma as unknown as PrismaService, { NODE_ENV: 'test' } as Env);

    expect(await worker.run(now)).toBe(1);
    expect(jobUpdate).toHaveBeenCalledWith({ where: { deletedAt: { lte: trashCutoff(now) }, purgedAt: null, id: 'j1' }, data: { purgedAt: now } });
    expect(savedDelete).toHaveBeenCalledWith({ where: { jobId: 'j1' } });
  });
});
