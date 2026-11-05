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
import {RolesGuard} from "../auth/guards/roles.guard";
import {Roles} from "../auth/decorators/roles.decorator";
import {Role} from "../users/role.enum";

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
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
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
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    const pageSize = limit ?? 20;
    if (pageSize < 1 || pageSize > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    if (cursor !== undefined && cursor < 1) {
      throw new BadRequestException('cursor must be a positive integer');
    }
    return this.wallet.history(req.user.id, pageSize, cursor);
  }
}
