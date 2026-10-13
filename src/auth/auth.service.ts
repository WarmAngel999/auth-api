import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) {}

    async register(dto: RegisterDto) {
        const existing = await this.usersService.findByEmail(dto.email);
        if (existing) {
            throw new ConflictException('Пользователь с таким email уже существует');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.usersService.create(dto.email, passwordHash);
        return { id: user.id, email: user.email, role: user.role };
    }

    async validateUser(email: string, password: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        return ok ? user : null;
    }

    login(user: User) {
        return this.issueTokens(user);
    }

    async refresh(userId: number, refreshToken: string) {
        const user = await this.usersService.findById(userId);
        if (!user || !user.refreshTokenHash) {
            throw new UnauthorizedException('Доступ запрещён');
        }

        const incoming = Buffer.from(this.hashToken(refreshToken));
        const stored = Buffer.from(user.refreshTokenHash);
        const valid =
            incoming.length === stored.length && timingSafeEqual(incoming, stored);

        if (!valid) {
            await this.usersService.setRefreshTokenHash(user.id, null);
            throw new UnauthorizedException('Доступ запрещён');
        }

        return this.issueTokens(user);
    }

    async logout(userId: number) {
        await this.usersService.setRefreshTokenHash(userId, null);
    }

    private hashToken(token: string) {
        return createHash('sha256').update(token).digest('hex');
    }

    private async issueTokens(user: User) {
        const payload = { sub: user.id, email: user.email, role: user.role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
                expiresIn: '15m',
            }),
            this.jwtService.signAsync(
                { ...payload, jti: randomUUID() },
                {
                    secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
                    expiresIn: '7d',
                },
            ),
        ]);

        await this.usersService.setRefreshTokenHash(
            user.id,
            this.hashToken(refreshToken),
        );

        return { accessToken, refreshToken };
    }
}