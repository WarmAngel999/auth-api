import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(
    job: Job<{
      transferId: number;
      fromUserId: number;
      toUserId: number;
      amount: number;
    }>,
  ): Promise<void> {
    const { transferId, fromUserId, toUserId, amount } = job.data;
    this.logger.log(
      `Уведомление: пользователь ${toUserId} получил ${amount} от ${fromUserId} (перевод ${transferId})`,
    );
  }
}
