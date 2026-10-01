import { Global, Injectable, Module } from '@nestjs/common';
import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Trường không bao giờ được ghi vào audit log */
const SENSITIVE_KEYS = new Set(['passwordHash', 'mfaSecretEnc', 'mfaRecoveryHashes', 'refreshTokenHash', 'previousTokenHash', 'codeHash', 'googleId', 'token']);

function scrub(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value, (key, v: unknown) => (SENSITIVE_KEYS.has(key) ? '[ẩn]' : v))) as Prisma.InputJsonValue;
}

export interface AuditEntry {
  actorId: string;
  /** vd. job.approve, verification.request_info, admin.login */
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Nhật ký thao tác quản trị (RULE-BE.md mục 7). Chỉ có hàm ghi – không có sửa / xoá.
 * Gọi trong cùng transaction với thao tác chính khi có thể (truyền tx).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, req?: Request, tx: Prisma.TransactionClient = this.prisma) {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        before: scrub(entry.before),
        after: scrub(entry.after),
        ip: req?.ip,
        userAgent: req?.headers['user-agent']?.slice(0, 300),
      },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
