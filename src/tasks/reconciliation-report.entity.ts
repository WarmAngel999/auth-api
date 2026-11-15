import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface WalletMismatch {
  walletId: number;
  userId: number;
  balance: number; // что записано в кошельке, в копейках
  expected: number; // что получилось по журналу: входящие минус исходящие
  diff: number; // balance - expected
}

@Entity('reconciliation_reports')
export class ReconciliationReport {
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_reconciliation_reports',
  })
  id: number;

  @Column({ name: 'checked_wallets', type: 'int' })
  checkedWallets: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  mismatches: WalletMismatch[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
