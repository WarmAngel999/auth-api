import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @HttpCode(200)
  @Post('login')
  login(@Req() req: { user: User }) {
    return this.authService.login(req.user);
  }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { id: number; email: string; role: string } }) {
    return req.user;
  }
  @UseGuards(JwtRefreshGuard)
  @HttpCode(200)
  @Post('refresh')
  refresh(
    @Req()
    req: {
      user: { id: number; sessionId: string; refreshToken: string };
    },
  ) {
    return this.authService.refresh(
      req.user.id,
      req.user.sessionId,
      req.user.refreshToken,
    );
  }

  @UseGuards(JwtRefreshGuard)
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: { user: { id: number; sessionId: string } }) {
    await this.authService.logout(req.user.id, req.user.sessionId);
    return { loggedOut: true };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(@Req() req: { user: { id: number } }) {
    await this.authService.logoutAll(req.user.id);
    return { loggedOut: true };
  }
}
