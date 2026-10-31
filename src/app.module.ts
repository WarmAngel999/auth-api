import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { BullModule } from '@nestjs/bullmq';
import {MailModule} from './mail/mail.module';
import {OutboxModule} from "./outbox/outbox.module";


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        const access = env.JWT_ACCESS_SECRET;
        const refresh = env.JWT_REFRESH_SECRET;
        if (
          typeof access !== 'string' ||
          typeof refresh !== 'string' ||
          access.length < 32 ||
          refresh.length < 32
        ) {
          throw new Error(
            'JWT_ACCESS_SECRET и JWT_REFRESH_SECRET должны быть заданы и быть не короче 32 символов',
          );
        }
        if (access === refresh) {
          throw new Error(
            'JWT_ACCESS_SECRET и JWT_REFRESH_SECRET должны отличаться',
          );
        }
        return env;
      },
    }),
    MailModule,
    OutboxModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: Number(config.get('DB_PORT')),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: config.get('NODE_ENV') !== 'development',
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6380)),
        },
      }),
    }),
    UsersModule,
    AuthModule,
    WalletModule,
  ],
})
export class AppModule {}
