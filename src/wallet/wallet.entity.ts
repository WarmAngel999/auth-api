import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('wallets')
@Check('"balance" >= 0')
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @Column({ type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  balance: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
