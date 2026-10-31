import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxRelay } from './outbox.relay';
import {ConfigService} from "@nestjs/config";

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent]),
    BullModule.registerQueueAsync({
      name: 'mail',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: Number(config.get('REDIS_PORT', 6380)),
          enableOfflineQueue: false,
        },
      }),
    }),
  ],
  providers: [OutboxRelay],
  exports: [TypeOrmModule],
})
export class OutboxModule {}
