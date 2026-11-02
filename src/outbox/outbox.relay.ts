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
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('mail') private readonly mailQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  onModuleInit() {
    if (process.env.OUTBOX_RELAY_AUTOSTART === 'false') return;
    this.timer = setInterval(() => void this.tick(), 1000);
    this.cleanupTimer = setInterval(() => void this.cleanup(), 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
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
    switch (event.type) {
      case 'user.registered': {
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
      case 'transfer.completed': {
        const p = event.payload as {
          transferId: number;
          fromUserId: number;
          toUserId: number;
          amount: number;
        };
        await this.withTimeout(
          this.notificationsQueue.add('transfer-completed', p, {
            jobId: `transfer-${p.transferId}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 3600 },
            removeOnFail: 100,
          }),
          3000,
        );
        return;
      }
      default:
        this.logger.warn(`Неизвестный тип события: ${event.type}`);
    }
  }
  async cleanup(days = 7) {
    try {
      const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from(OutboxEvent)
        .where('processed_at < :threshold', { threshold })
        .execute();

      if (result.affected) {
        this.logger.log(`Удалено обработанных событий: ${result.affected}`);
      }
    } catch (error) {
      this.logger.warn(`Не удалось очистить outbox: ${(error as Error).message}`);
    }
  }
}
