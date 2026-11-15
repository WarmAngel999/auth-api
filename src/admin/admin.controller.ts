import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TasksService } from '../tasks/tasks.service';
import { Role } from '../users/role.enum';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly tasks: TasksService,
    private readonly admin: AdminService,
  ) {}

  @Post('reconcile')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  reconcile() {
    return this.tasks.reconcileBalances();
  }

  @Get('outbox/stats')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  outboxStats() {
    return this.admin.outboxStats();
  }
}
