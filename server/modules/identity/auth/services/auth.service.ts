import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { RefreshSession } from '../entities/refresh-session.entity';
import {
  ACCESS_EXPIRES_MS,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  SALT_ROUNDS,
} from '../auth.constants';

export type AuthMethod = 'password' | 'google' | 'refresh';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async createAuthSession(
    userId: string,
    rememberMe: boolean,
    ctx: RequestContext,
    authMethod: AuthMethod,
  ): Promise<TokenPair> {
    const familyId = randomUUID();
    const tokens = await this.issueTokens(userId, familyId, rememberMe, authMethod);
    await this.createRefreshSession(userId, familyId, tokens, ctx);
    return tokens;
  }

  async refreshTokens(
    userId: string,
    sessionId: string,
    familyId: string,
    rawRefreshToken: string,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const sessionRepo = this.dataSource.getRepository(RefreshSession);

    const session = await sessionRepo.findOne({
      where: { id: sessionId, userId, familyId },
      select: { id: true, hashedToken: true, expiresAt: true, familyId: true },
    });

    if (!session) {
      // Token replayed after rotation — possible theft, revoke entire family
      await sessionRepo.delete({ userId, familyId });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const valid = await bcrypt.compare(rawRefreshToken, session.hashedToken);
    if (!valid) throw new UnauthorizedException();

    await sessionRepo.delete(session.id);

    const tokens = await this.issueTokens(userId, familyId, false, 'refresh');
    await this.createRefreshSession(userId, familyId, tokens, ctx);
    return tokens;
  }

  async signOut(userId: string, sessionId: string): Promise<void> {
    await this.dataSource.getRepository(RefreshSession).delete({ id: sessionId, userId });
  }

  private async issueTokens(
    userId: string,
    familyId: string,
    rememberMe: boolean,
    authMethod: AuthMethod,
  ): Promise<TokenPair> {
    const accessSecret = this.configService.getOrThrow<string>('auth.accessSecret');
    const refreshSecret = this.configService.getOrThrow<string>('auth.refreshSecret');

    const sessionId = randomUUID();
    const refreshMs = rememberMe ? REFRESH_REMEMBER_ME_EXPIRES_MS : REFRESH_EXPIRES_MS;
    const refreshExpiresAt = new Date(Date.now() + refreshMs);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, auth_method: authMethod },
        { secret: accessSecret, expiresIn: ACCESS_EXPIRES_MS / 1000 },
      ),
      this.jwtService.signAsync(
        { sub: userId, sid: sessionId, fid: familyId },
        { secret: refreshSecret, expiresIn: refreshMs / 1000 },
      ),
    ]);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async createRefreshSession(
    userId: string,
    familyId: string,
    tokens: TokenPair,
    ctx: RequestContext,
  ): Promise<void> {
    // Decode the refresh token to get the sessionId (sid) we embedded
    const decoded = this.jwtService.decode<{ sid: string }>(tokens.refreshToken);
    const sessionId = decoded.sid;

    const hashed = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    const sessionRepo = this.dataSource.getRepository(RefreshSession);
    const session = sessionRepo.create({
      id: sessionId,
      userId,
      familyId,
      hashedToken: hashed,
      expiresAt: tokens.refreshExpiresAt,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await sessionRepo.save(session);
  }
}
