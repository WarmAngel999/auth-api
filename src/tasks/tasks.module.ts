import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationReport } from './reconciliation-report.entity';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReconciliationReport])],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
