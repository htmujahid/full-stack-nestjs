import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Account } from './account.entity';
import { RefreshSession } from './refresh-session.entity';
import { User } from '../user/user.entity';
import {
  ACCESS_EXPIRES_MS,
  CREDENTIAL_PROVIDER,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  SALT_ROUNDS,
  VERIFICATION_EXPIRES_MS,
} from './auth.constants';
import type { SignUpDto } from './dto/sign-up.dto';

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
    private readonly mailerService: MailerService,
  ) {}

  async signUp(dto: SignUpDto): Promise<{ user: User }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    return this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);

      const existing = await userRepo.findOne({ where: { email: normalizedEmail } });
      if (existing) {
        throw new ConflictException('User already exists. Use another email.');
      }

      const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

      const user = userRepo.create({
        name: dto.name,
        email: normalizedEmail,
        image: dto.image ?? null,
        emailVerified: false,
      });
      const savedUser = await userRepo.save(user);

      const account = accountRepo.create({
        userId: savedUser.id,
        providerId: CREDENTIAL_PROVIDER,
        accountId: savedUser.id,
        password: hash,
      });
      await accountRepo.save(account);

      await this.sendVerificationEmail(normalizedEmail, dto.callbackURL);

      return { user: savedUser };
    });
  }

  async signIn(
    user: User,
    rememberMe: boolean,
    ctx: RequestContext,
  ): Promise<{ user: User; tokens: TokenPair }> {
    const familyId = randomUUID();
    const tokens = await this.issueTokens(user.id, familyId, rememberMe);
    await this.createRefreshSession(user.id, familyId, tokens, ctx);
    return { user, tokens };
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

    const tokens = await this.issueTokens(userId, familyId, false);
    await this.createRefreshSession(userId, familyId, tokens, ctx);
    return tokens;
  }

  async signOut(userId: string, sessionId: string): Promise<void> {
    await this.dataSource.getRepository(RefreshSession).delete({ id: sessionId, userId });
  }

  async verifyEmail(
    token: string,
    ctx: RequestContext,
  ): Promise<{ ok: true; user: User; tokens: TokenPair } | { ok: false; error: string }> {
    try {
      const accessSecret = this.configService.getOrThrow<string>('auth.accessSecret');
      const payload = await this.jwtService.verifyAsync<{ email?: string }>(token, {
        secret: accessSecret,
      });
      const email = payload.email;
      if (!email || typeof email !== 'string') {
        return { ok: false, error: 'invalid_token' };
      }

      const userRepo = this.dataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { email: email.toLowerCase() } });
      if (!user) return { ok: false, error: 'user_not_found' };

      if (!user.emailVerified) {
        await userRepo.update(user.id, { emailVerified: true });
        user.emailVerified = true;
      }

      const familyId = randomUUID();
      const tokens = await this.issueTokens(user.id, familyId, false);
      await this.createRefreshSession(user.id, familyId, tokens, ctx);

      return { ok: true, user, tokens };
    } catch {
      return { ok: false, error: 'invalid_token' };
    }
  }

  async resendVerificationEmail(email: string, callbackURL?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizedEmail } });

    if (!user || user.emailVerified) return; // prevent enumeration
    await this.sendVerificationEmail(normalizedEmail, callbackURL);
  }

  private async issueTokens(userId: string, familyId: string, rememberMe: boolean): Promise<TokenPair> {
    const accessSecret = this.configService.getOrThrow<string>('auth.accessSecret');
    const refreshSecret = this.configService.getOrThrow<string>('auth.refreshSecret');

    const sessionId = randomUUID();
    const refreshMs = rememberMe ? REFRESH_REMEMBER_ME_EXPIRES_MS : REFRESH_EXPIRES_MS;
    const refreshExpiresAt = new Date(Date.now() + refreshMs);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId },
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

  private async sendVerificationEmail(email: string, callbackURL?: string): Promise<void> {
    const accessSecret = this.configService.getOrThrow<string>('auth.accessSecret');

    const token = await this.jwtService.signAsync(
      { email },
      { secret: accessSecret, expiresIn: VERIFICATION_EXPIRES_MS / 1000 },
    );
    const encodedCallback = encodeURIComponent(callbackURL ?? '/');
    const baseURL = this.configService.getOrThrow<string>('app.url');
    const url = `${baseURL}/api/auth/verify-email?token=${token}&callbackURL=${encodedCallback}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your email',
      text: `Verify your email by clicking: ${url}`,
      html: `<p>Verify your email by clicking: <a href="${url}">${url}</a></p>`,
    });
  }
}
