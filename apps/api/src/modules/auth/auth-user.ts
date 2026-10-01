import type { AuthUser } from '@viecpro/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AssetUrlService } from '../../core/assets/asset-url.service.js';

/** include cần thiết để dựng AuthUser */
export const authUserInclude = {
  recruiter: { select: { employer: { select: { id: true, slug: true, name: true } } } },
} satisfies Prisma.UserInclude;

type UserWithEmployer = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

export function toAuthUser(user: UserWithEmployer, assets: AssetUrlService): AuthUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: assets.url(user.avatarUrl),
    phoneVerified: !!user.phoneVerifiedAt,
    employer: user.recruiter?.employer ?? null,
  };
}
