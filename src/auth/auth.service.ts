import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.usersService.create(dto.email, passwordHash);
      return { id: user.id, email: user.email, role: user.role };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Пользователь с таким email уже существует',
        );
      }
      throw error;
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  login(user: User) {
    return this.startSession(user);
  }

  async refresh(userId: number, sessionId: string, refreshToken: string) {
    const session = await this.refreshRepo.findOneBy({ id: sessionId, userId });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Доступ запрещён');
    }

    const incoming = Buffer.from(this.hashToken(refreshToken));
    const stored = Buffer.from(session.tokenHash);
    const valid =
      incoming.length === stored.length && timingSafeEqual(incoming, stored);

    if (!valid) {
      // старый токен использован повторно: закрываем только эту сессию
      await this.refreshRepo.delete({ id: sessionId });
      throw new UnauthorizedException('Доступ запрещён');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      await this.refreshRepo.delete({ id: sessionId });
      throw new UnauthorizedException('Доступ запрещён');
    }

    const newRefreshToken = await this.signRefresh(userId, sessionId);
    await this.refreshRepo.update(
      { id: sessionId },
      {
        tokenHash: this.hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    );
    const accessToken = await this.signAccess(user);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: number, sessionId: string) {
    await this.refreshRepo.delete({ id: sessionId, userId });
  }

  async logoutAll(userId: number) {
    await this.refreshRepo.delete({ userId });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const { driverError } = error as { driverError?: { code?: string } };
    return driverError?.code === '23505';
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccess(user: User) {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, typ: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  private signRefresh(userId: number, sessionId: string) {
    return this.jwtService.signAsync(
      { sub: userId, jti: sessionId, typ: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
  }

  private async startSession(user: User) {
    const sessionId = randomUUID();
    const refreshToken = await this.signRefresh(user.id, sessionId);

    await this.refreshRepo.insert({
      id: sessionId,
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    const accessToken = await this.signAccess(user);
    return { accessToken, refreshToken };
  }
}
