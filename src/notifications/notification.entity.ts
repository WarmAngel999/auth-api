import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('notifications')
@Unique('UQ_notifications_event_id', ['eventId'])
@Index('idx_notifications_user_id_id', ['userId', 'id'])
@Index('idx_notifications_unread', ['userId'], { where: '"read_at" IS NULL' })
export class Notification {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_notifications' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_notifications_user',
  })
  user: User;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column()
  type: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
