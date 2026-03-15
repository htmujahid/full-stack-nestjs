import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import type { AuthMethod } from '../services/auth.service';
import { UserRole } from '../../user/user-role.enum';

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
  auth_method: AuthMethod;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string>)?.[ACCESS_TOKEN_COOKIE] ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.accessSecret'),
    });
  }

  validate(payload: JwtAccessPayload) {
    return {
      userId: payload.sub,
      role: payload.role,
      authMethod: payload.auth_method,
    };
  }
}
