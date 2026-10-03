import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { conversationListSchema, messageBodySchema, messageCursorSchema, type ConversationListQuery, type MessageCursorQuery } from '@viecpro/shared';
import { type AuthPayload, CurrentUser, Roles } from '../../core/auth/auth.decorators.js';
import { ZodBody, ZodQuery } from '../../core/http/zod.js';
import { ConversationsService } from './conversations.service.js';

@ApiTags('Tin nhắn')
@ApiBearerAuth()
@Controller()
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Roles('employer')
  @Get('employer/conversations')
  listEmployer(@CurrentUser() user: AuthPayload, @ZodQuery(conversationListSchema) query: ConversationListQuery) { return this.conversations.list('employer', user.sub, query); }

  @Roles('employer')
  @Get('employer/conversations/unread-count')
  unreadEmployer(@CurrentUser() user: AuthPayload) { return this.conversations.unreadCount('employer', user.sub); }

  @Roles('employer')
  @Post('employer/applications/:id/conversation')
  @ApiOperation({ summary: 'NTD mở cuộc trò chuyện cho hồ sơ đã ứng tuyển' })
  open(@CurrentUser() user: AuthPayload, @Param('id') id: string) { return this.conversations.open(user.sub, id); }

  @Roles('employer')
  @Get('employer/conversations/:id/messages')
  messagesEmployer(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodQuery(messageCursorSchema) query: MessageCursorQuery) { return this.conversations.messages('employer', user.sub, id, query.before, query.after); }

  @Roles('employer')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('employer/conversations/:id/messages')
  sendEmployer(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(messageBodySchema) body: { body: string }) { return this.conversations.send('employer', user.sub, id, body.body); }

  @Roles('employer')
  @Post('employer/conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readEmployer(@CurrentUser() user: AuthPayload, @Param('id') id: string) { await this.conversations.read('employer', user.sub, id); }

  @Roles('seeker')
  @Get('me/conversations')
  listSeeker(@CurrentUser() user: AuthPayload, @ZodQuery(conversationListSchema) query: ConversationListQuery) { return this.conversations.list('seeker', user.sub, query); }

  @Roles('seeker')
  @Get('me/conversations/unread-count')
  unreadSeeker(@CurrentUser() user: AuthPayload) { return this.conversations.unreadCount('seeker', user.sub); }

  @Roles('seeker')
  @Get('me/conversations/:id/messages')
  messagesSeeker(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodQuery(messageCursorSchema) query: MessageCursorQuery) { return this.conversations.messages('seeker', user.sub, id, query.before, query.after); }

  @Roles('seeker')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('me/conversations/:id/messages')
  sendSeeker(@CurrentUser() user: AuthPayload, @Param('id') id: string, @ZodBody(messageBodySchema) body: { body: string }) { return this.conversations.send('seeker', user.sub, id, body.body); }

  @Roles('seeker')
  @Post('me/conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readSeeker(@CurrentUser() user: AuthPayload, @Param('id') id: string) { await this.conversations.read('seeker', user.sub, id); }
}
