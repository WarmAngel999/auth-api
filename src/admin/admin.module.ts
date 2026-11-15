import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { TasksModule } from '../tasks/tasks.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TasksModule, OutboxModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
