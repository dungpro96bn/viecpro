import type { Paginated, PaginationQuery } from '@viecpro/shared';

/** { skip, take } cho Prisma từ query page / limit */
export function pageArgs({ page, limit }: PaginationQuery) {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(items: T[], total: number, { page, limit }: PaginationQuery): Paginated<T> {
  return { items, page, limit, total, hasMore: page * limit < total };
}
