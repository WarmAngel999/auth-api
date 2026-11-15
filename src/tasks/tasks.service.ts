import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Transfer } from '../wallet/transfer.entity';
import { Wallet } from '../wallet/wallet.entity';
import {
  ReconciliationReport,
  WalletMismatch,
} from './reconciliation-report.entity';

// входящие минус исходящие по журналу, считает сама база
const INCOMING =
  'COALESCE(SUM(CASE WHEN t.toWalletId = w.id THEN t.amount ELSE 0 END), 0)';
const OUTGOING =
  'COALESCE(SUM(CASE WHEN t.fromWalletId = w.id THEN t.amount ELSE 0 END), 0)';
const EXPECTED = `${INCOMING} - ${OUTGOING}`;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly dataSource: DataSource) {}

  // расписание: только вызывает методы ниже, чтобы тесты вызывали их напрямую
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledCleanup() {
    try {
      await this.cleanupExpiredSessions();
    } catch (error) {
      this.logger.error(
        `Очистка сессий не удалась: ${(error as Error).message}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledReconcile() {
    try {
      await this.reconcileBalances();
    } catch (error) {
      this.logger.error(
        `Сверка балансов не удалась: ${(error as Error).message}`,
      );
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.dataSource
      .getRepository(RefreshToken)
      .delete({ expiresAt: LessThan(new Date()) });
    const deleted = result.affected ?? 0;
    this.logger.log(`Удалено истёкших сессий: ${deleted}`);
    return deleted;
  }

  async reconcileBalances(): Promise<ReconciliationReport> {
    // один снимок данных на всю сверку: перевод, который идёт прямо сейчас,
    // не создаст ложного расхождения между подсчётом и запросом
    const report = await this.dataSource.transaction(
      'REPEATABLE READ',
      async (m) => {
        const checkedWallets = await m.count(Wallet);

        const rows = await m
          .createQueryBuilder()
          .select('w.id', 'walletId')
          .addSelect('w.userId', 'userId')
          .addSelect('w.balance', 'balance')
          .addSelect(EXPECTED, 'expected')
          .from(Wallet, 'w')
          .leftJoin(
            Transfer,
            't',
            't.fromWalletId = w.id OR t.toWalletId = w.id',
          )
          .groupBy('w.id')
          .having(`w.balance <> ${EXPECTED}`)
          .orderBy('w.id', 'ASC')
          .getRawMany<{
            walletId: string;
            userId: string;
            balance: string;
            expected: string;
          }>();

        const mismatches: WalletMismatch[] = rows.map((r) => ({
          walletId: Number(r.walletId),
          userId: Number(r.userId),
          balance: Number(r.balance),
          expected: Number(r.expected),
          diff: Number(r.balance) - Number(r.expected),
        }));

        return m.save(
          m.create(ReconciliationReport, { checkedWallets, mismatches }),
        );
      },
    );

    if (report.mismatches.length > 0) {
      this.logger.warn(
        `Сверка балансов: проверено ${report.checkedWallets}, расхождений ${report.mismatches.length}: ${JSON.stringify(report.mismatches)}`,
      );
    } else {
      this.logger.log(
        `Сверка балансов: проверено ${report.checkedWallets}, расхождений нет`,
      );
    }
    return report;
  }
}
