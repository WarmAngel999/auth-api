import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }
    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@Req() req: { user: { id: number; email: string; role: string } }) {
        return req.user;
    }
    @UseGuards(LocalAuthGuard)
    @HttpCode(200)
    @Post('login')
    login(@Req() req: { user: User }) {
        return this.authService.login(req.user);
    }
    @UseGuards(JwtRefreshGuard)
    @HttpCode(200)
    @Post('refresh')
    refresh(@Req() req: { user: { id: number; refreshToken: string } }) {
        return this.authService.refresh(req.user.id, req.user.refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Post('logout')
    async logout(@Req() req: { user: { id: number } }) {
        await this.authService.logout(req.user.id);
        return { loggedOut: true };
    }
}