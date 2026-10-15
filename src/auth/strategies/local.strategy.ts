import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly authService: AuthService) {
        super({ usernameField: 'email' });
    }

    async validate(email: unknown, password: unknown) {
        const dto = plainToInstance(LoginDto, { email, password });
        if (validateSync(dto).length > 0) {
            throw new BadRequestException('Некорректные email или пароль');
        }

        const user = await this.authService.validateUser(dto.email, dto.password);
        if (!user) throw new UnauthorizedException('Неверный email или пароль');
        return user;
    }
}