import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
            ignoreExpiration: false,
            secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
            passReqToCallback: true,
        });
    }

    validate(
        req: { body: { refreshToken: string } },
        payload: { sub: number; jti: string; typ: string },
    ) {
        if (payload.typ !== 'refresh') throw new UnauthorizedException();
        return {
            id: payload.sub,
            sessionId: payload.jti,
            refreshToken: req.body.refreshToken,
        };
    }
}