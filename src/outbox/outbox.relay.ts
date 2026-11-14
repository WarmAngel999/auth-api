import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

const PUBLISH_INTERVAL_MS = 2000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const BATCH_SIZE = 100;

const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: 100,
};

@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('mail') private readonly mailQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  // расписание: в тестах отключается переменной, а tick() вызывается напрямую
  @Interval(PUBLISH_INTERVAL_MS)
  async scheduledTick() {
    if (process.env.OUTBOX_RELAY_AUTOSTART === 'false') return;
    await this.tick();
  }

  @Interval(CLEANUP_INTERVAL_MS)
  async scheduledCleanup() {
    if (process.env.OUTBOX_RELAY_AUTOSTART === 'false') return;
    await this.cleanup();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.dataSource.transaction(async (m) => {
        const events = await m
          .createQueryBuilder(OutboxEvent, 'e')
          .where('e.published_at IS NULL')
          .orderBy('e.createdAt', 'ASC')
          .limit(BATCH_SIZE)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();
        if (events.length > 0) {
          this.logger.log(`Найдено событий: ${events.length}`);
        }

        for (const event of events) {
          await this.dispatch(event);
          await m.update(
            OutboxEvent,
            { id: event.id },
            { publishedAt: new Date() },
          );
        }
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось отправить события: ${(error as Error).message}`,
      );
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
        const { userId, email } = event.payload as {
          userId: number;
          email: string;
        };
        await this.withTimeout(
          this.mailQueue.add(
            'confirm-email',
            { userId, email },
            { ...JOB_OPTIONS, jobId: `confirm-${userId}` },
          ),
          3000,
        );
        return;
      }
      case 'transfer.completed': {
        // jobId = id события: повторная публикация того же события не создаст вторую задачу
        await this.withTimeout(
          this.notificationsQueue.add(
            'transfer-completed',
            { ...event.payload, eventId: event.id },
            { ...JOB_OPTIONS, jobId: event.id },
          ),
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
        .where('published_at < :threshold', { threshold })
        .execute();

      if (result.affected) {
        this.logger.log(`Удалено опубликованных событий: ${result.affected}`);
      }
    } catch (error) {
      this.logger.warn(
        `Не удалось очистить outbox: ${(error as Error).message}`,
      );
    }
  }
}
