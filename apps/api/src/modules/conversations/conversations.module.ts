import { Module } from '@nestjs/common';
import { EmployerContext } from '../employer-portal/employer-context.service.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { NoopRealtimePublisher, RealtimePublisher } from '../../core/realtime/realtime-publisher.js';

@Module({ controllers: [ConversationsController], providers: [EmployerContext, ConversationsService, { provide: RealtimePublisher, useClass: NoopRealtimePublisher }] })
export class ConversationsModule {}
