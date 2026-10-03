import { z } from 'zod';
import { paginationSchema } from './common.js';

export const messageBodySchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const conversationListSchema = paginationSchema.extend({ q: z.string().trim().max(100).optional() });
export const messageCursorSchema = z.object({ after: z.string().max(200).optional(), before: z.string().max(200).optional() }).refine((q) => !(q.after && q.before), 'Chỉ truyền after hoặc before');
export type ConversationListQuery = z.infer<typeof conversationListSchema>;
export type MessageCursorQuery = z.infer<typeof messageCursorSchema>;
