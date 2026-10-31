import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  async process(job: Job<{ userId: number; email: string }>): Promise<void> {
    this.logger.log(
      `Задача ${job.id}, попытка ${job.attemptsMade + 1}: письмо для ${job.data.email}`,
    );

    if (process.env.MAIL_FAIL === '1' && job.attemptsMade < 2) {
      throw new Error('SMTP недоступен (имитация)');
    }

    this.logger.log(`Письмо отправлено на ${job.data.email}`);
  }
}
