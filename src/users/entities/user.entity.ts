import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    email: string;

    @Column()
    passwordHash: string;

    @Column({ default: 'user' })
    role: string;

    @Column({ type: 'varchar', nullable: true })
    refreshTokenHash: string | null;
}