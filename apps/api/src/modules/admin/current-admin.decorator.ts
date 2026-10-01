import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AdminContext, AdminRequest } from './admin-access.js';

/** Admin đang thao tác (chỉ dùng trong controller có @AdminController) */
export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminContext => {
  const admin = ctx.switchToHttp().getRequest<AdminRequest>().admin;
  if (!admin) throw new Error('CurrentAdmin dùng ngoài AdminGuard');
  return admin;
});
