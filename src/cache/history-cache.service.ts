import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

const TTL_SECONDS = 60;
const VERSION_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class HistoryCache implements OnModuleDestroy {
  private readonly logger = new Logger(HistoryCache.name);
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(config: ConfigService) {
    this.prefix = config.get<string>('CACHE_PREFIX', '');
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: Number(config.get('REDIS_PORT', 6380)),
      enableOfflineQueue: false,
      commandTimeout: 500,
    });
    this.redis.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
  }

  private versionKey(userId: number) {
    return `${this.prefix}wallet:history:ver:${userId}`;
  }

  private dataKey(userId: number, version: string, limit: number, offset: number) {
    return `${this.prefix}wallet:history:${userId}:v${version}:${limit}:${offset}`;
  }

  async getOrLoad<T>(
    userId: number,
    limit: number,
    offset: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    let key: string | null = null;
    try {
      const version = (await this.redis.get(this.versionKey(userId))) ?? '0';
      key = this.dataKey(userId, version, limit, offset);
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (error) {
      key = null;
      this.logger.warn(`Кэш недоступен, читаем из базы: ${(error as Error).message}`);
    }

    const value = await loader();

    if (key) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', TTL_SECONDS);
      } catch (error) {
        this.logger.warn(`Не удалось записать в кэш: ${(error as Error).message}`);
      }
    }
    return value;
  }

  async invalidate(...userIds: number[]) {
    try {
      const pipeline = this.redis.multi();
      for (const id of userIds) {
        pipeline.incr(this.versionKey(id));
        pipeline.expire(this.versionKey(id), VERSION_TTL_SECONDS);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`Не удалось сбросить кэш: ${(error as Error).message}`);
    }
  }

  // только для тестов
  async flush() {
    const keys = await this.redis.keys(`${this.prefix}wallet:history:*`);
    if (keys.length) await this.redis.del(...keys);
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
