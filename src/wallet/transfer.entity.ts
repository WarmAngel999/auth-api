import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';

const bigintTransformer = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity('transfers')
@Index(['fromWalletId', 'idempotencyKey'], { unique: true })
@Check('"amount" > 0')
export class Transfer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'from_wallet_id' })
  fromWallet: Wallet;

  @Column({ name: 'from_wallet_id' })
  fromWalletId: number;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'to_wallet_id' })
  toWallet: Wallet;

  @Column({ name: 'to_wallet_id' })
  toWalletId: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
