import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  NotificationsService,
  TransferCompletedData,
} from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'transfer-completed') {
      await this.notifications.createFromTransfer(
        job.data as TransferCompletedData,
      );
      return;
    }
    this.logger.warn(`Неизвестная задача: ${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      // попытки закончились: задача остаётся в статусе failed
      this.logger.error(
        `Задача ${job.id} не выполнена за ${job.attemptsMade} попыток: ${error.message}`,
      );
    } else {
      this.logger.warn(
        `Задача ${job.id}: попытка ${job.attemptsMade} из ${attempts} не удалась: ${error.message}`,
      );
    }
  }
}
