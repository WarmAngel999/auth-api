import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { Transfer } from './transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, Transfer])],
})
export class WalletModule {}
