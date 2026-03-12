import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { RefreshSession } from '../entities/refresh-session.entity';
import { REFRESH_TOKEN_COOKIE } from '../auth.constants';

export interface JwtRefreshPayload {
  sub: string;
  sid: string; // session ID
  fid: string; // family ID
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string>)?.[REFRESH_TOKEN_COOKIE] ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.refreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtRefreshPayload) {
    const rawToken =
      (req.cookies as Record<string, string>)?.[REFRESH_TOKEN_COOKIE] ??
      req.headers.authorization?.split(' ')[1];

    if (!rawToken) throw new UnauthorizedException();

    // Verify session exists — theft detection happens inside AuthService.refreshTokens
    const session = await this.dataSource
      .getRepository(RefreshSession)
      .findOne({
        where: { id: payload.sid, userId: payload.sub, familyId: payload.fid },
      });

    if (!session) {
      // Replayed token — revoke entire family
      await this.dataSource
        .getRepository(RefreshSession)
        .delete({ userId: payload.sub, familyId: payload.fid });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (session.expiresAt < new Date()) {
      await this.dataSource.getRepository(RefreshSession).delete(session.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      familyId: payload.fid,
      rawRefreshToken: rawToken,
    };
  }
}
