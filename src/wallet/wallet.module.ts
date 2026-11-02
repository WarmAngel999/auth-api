import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { Transfer } from './transfer.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import {HistoryCacheModule} from "../cache/history-cache.module";

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transfer]), HistoryCacheModule],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
