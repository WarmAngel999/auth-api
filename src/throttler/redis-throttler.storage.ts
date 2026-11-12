import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

type ThrottlerRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
if blockDuration <= 0 then blockDuration = ttl end

local blockLeft = redis.call('PTTL', blockKey)
if blockLeft > 0 then
  local hits = tonumber(redis.call('GET', hitsKey) or '0')
  return {hits, math.max(redis.call('PTTL', hitsKey), 0), 1, blockLeft}
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
end
local ttlLeft = math.max(redis.call('PTTL', hitsKey), 0)

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return {hits, ttlLeft, 1, blockDuration}
end
return {hits, ttlLeft, 0, 0}
`;

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: Number(config.get('REDIS_PORT', 6380)),
      enableOfflineQueue: false,
      commandTimeout: 500,
    });
    this.redis.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const prefix = `throttle:${throttlerName}:${key}`;
    try {
      const [totalHits, ttlLeft, blocked, blockLeft] = (await this.redis.eval(
        SCRIPT,
        2,
        `${prefix}:hits`,
        `${prefix}:block`,
        ttl,
        limit,
        blockDuration,
      )) as number[];

      return {
        totalHits,
        timeToExpire: Math.ceil(ttlLeft / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockLeft / 1000),
      };
    } catch (error) {
      this.logger.warn(`Лимит не проверен: ${(error as Error).message}`);
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
