import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {}

  onModuleInit() {
    if (process.env.OUTBOX_RELAY_AUTOSTART === 'false') return;
    this.timer = setInterval(() => void this.tick(), 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.dataSource.transaction(async (m) => {
        const events = await m
          .createQueryBuilder(OutboxEvent, 'e')
          .where('e.processed_at IS NULL')
          .orderBy('e.id', 'ASC')
          .limit(50)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();
          if (events.length > 0) {
            this.logger.log(`Найдено событий: ${events.length}`);
          }

        for (const event of events) {
          await this.dispatch(event);
          await m.update(OutboxEvent, { id: event.id }, { processedAt: new Date() });
        }
      });
    } catch (error) {
      this.logger.warn(`Не удалось отправить события: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`очередь не ответила за ${ms} мс`)),
        ms,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
  private async dispatch(event: OutboxEvent) {
    if (event.type === 'user.registered') {
      const { userId, email } = event.payload as { userId: number; email: string };
      await this.withTimeout(
        this.mailQueue.add(
          'confirm-email',
          { userId, email },
          {
            jobId: `confirm-${userId}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 3600 },
            removeOnFail: 100,
          },
        ),
        3000,
      );
      return;
    }
    this.logger.warn(`Неизвестный тип события: ${event.type}`);
  }
}
