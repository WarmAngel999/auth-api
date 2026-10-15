import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryColumn('uuid')
    id: string; // он же jti: идентификатор сессии

    @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
    user: User;

    @Index()
    @Column()
    userId: number;

    @Column()
    tokenHash: string;

    @Column({ type: 'timestamptz' })
    expiresAt: Date;
}