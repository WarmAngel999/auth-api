import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Transfer } from './transfer.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreate(userId: number): Promise<Wallet> {
    await this.wallets
      .createQueryBuilder()
      .insert()
      .into(Wallet)
      .values({ userId })
      .orIgnore()
      .execute();
    return this.wallets.findOneByOrFail({ userId });
  }

  async deposit(userId: number, amount: number): Promise<Wallet> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }
    const wallet = await this.getOrCreate(userId);
    await this.dataSource.transaction(async (m) => {
      await m.increment(Wallet, { id: wallet.id }, 'balance', amount);
      await m.insert(Transfer, {
        type: 'deposit',
        fromWalletId: null,
        toWalletId: wallet.id,
        amount,
        idempotencyKey: null,
      });
    });
    return this.wallets.findOneByOrFail({ id: wallet.id });
  }
  async transfer(
    fromUserId: number,
    toUserId: number,
    amount: number,
    key: string,
  ): Promise<Transfer> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException('cannot transfer to yourself');
    }
    const toExists = await this.dataSource.getRepository(User).existsBy({ id: toUserId });
    if (!toExists) throw new NotFoundException('recipient not found');

    const from = await this.getOrCreate(fromUserId);
    const to = await this.getOrCreate(toUserId);

    try {
      return await this.dataSource.transaction(async (m) => {
        // 1. блокируем оба кошелька, всегда в порядке возрастания id
        const locked = await m.find(Wallet, {
          where: { id: In([from.id, to.id]) },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        const src = locked.find((w) => w.id === from.id)!;

        // 2. повтор запроса? уже под блокировкой
        const existing = await m.findOne(Transfer, {
          where: { fromWalletId: from.id, idempotencyKey: key },
        });
        if (existing) {
          if (existing.toWalletId !== to.id || existing.amount !== amount) {
            throw new ConflictException('idempotency key reused with different data');
          }
          return existing;
        }

        // 3. хватает ли денег
        if (src.balance < amount) {
          throw new BadRequestException('insufficient funds');
        }

        // 4. списать, зачислить, записать в журнал
        await m.decrement(Wallet, { id: from.id }, 'balance', amount);
        await m.increment(Wallet, { id: to.id }, 'balance', amount);
        return m.save(
          m.create(Transfer, {
            type: 'transfer',
            fromWalletId: from.id,
            toWalletId: to.id,
            amount,
            idempotencyKey: key,
          }),
        );
      });
    } catch (e: any) {
      // страховка: гонка на уникальном индексе (код 23505) -> отдаём первый результат
      if (e?.driverError?.code === '23505') {
        return this.dataSource.getRepository(Transfer).findOneByOrFail({
          fromWalletId: from.id,
          idempotencyKey: key,
        });
      }
      throw e;
    }
  }
  async history(userId: number, limit: number, cursor?: number) {
    const wallet = await this.getOrCreate(userId);

    const qb = this.dataSource
      .createQueryBuilder()
      .select('t.id', 'id')
      .addSelect('t.type', 'type')
      .addSelect('t.amount', 'amount')
      .addSelect('t.createdAt', 'createdAt')
      .addSelect('t.toWalletId', 'toWalletId')
      .addSelect('u.email', 'counterparty')
      .from(Transfer, 't')
      .leftJoin(
        Wallet,
        'cw',
        'cw.id = CASE WHEN t.toWalletId = :walletId THEN t.fromWalletId ELSE t.toWalletId END',
      )
      .leftJoin(User, 'u', 'u.id = cw.userId')
      .where('(t.fromWalletId = :walletId OR t.toWalletId = :walletId)', {
        walletId: wallet.id,
      })
      .orderBy('t.id', 'DESC')
      .limit(limit + 1);

    if (cursor) {
      qb.andWhere('t.id < :cursor', { cursor });
    }

    const rows = await qb.getRawMany();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((r) => ({
        id: r.id,
        type: r.type,
        direction: Number(r.toWalletId) === wallet.id ? 'in' : 'out',
        amount: Number(r.amount),
        counterparty: r.counterparty,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
