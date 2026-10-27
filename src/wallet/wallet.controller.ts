import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
// путь к guard оставь тот, который у тебя уже был в этом файле
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type AuthRequest = Request & { user: { id: number } };

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getWallet(@Req() req: AuthRequest) {
    return this.wallet.getOrCreate(req.user.id);
  }

  @Post('deposit')
  deposit(@Req() req: AuthRequest, @Body() dto: DepositDto) {
    return this.wallet.deposit(req.user.id, dto.amount);
  }

  @Post('transfer')
  transfer(
    @Req() req: AuthRequest,
    @Body() dto: TransferDto,
    @Headers('idempotency-key') key?: string,
  ) {
    if (!key || key.length > 100) {
      throw new BadRequestException(
        'Idempotency-Key header is required (max 100 chars)',
      );
    }
    return this.wallet.transfer(req.user.id, dto.toUserId, dto.amount, key);
  }
  @Get('transactions')
  history(
    @Req() req: AuthRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.wallet.history(
      req.user.id,
      Math.min(Math.max(limit, 1), 100),
      cursor,
    );
  }
}
