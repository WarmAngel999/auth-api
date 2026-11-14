import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

type AuthRequest = Request & { user: { id: number } };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() req: AuthRequest,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    const pageSize = limit ?? 20;
    if (pageSize < 1 || pageSize > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    if (cursor !== undefined && cursor < 1) {
      throw new BadRequestException('cursor must be a positive integer');
    }
    return this.notifications.list(req.user.id, pageSize, cursor);
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthRequest) {
    return this.notifications.unreadCount(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(req.user.id, id);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@Req() req: AuthRequest) {
    return this.notifications.markAllRead(req.user.id);
  }
}
