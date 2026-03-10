import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { User } from '../../user/user.entity';
import {
  CREDENTIAL_PROVIDER,
  RESET_PASSWORD_EXPIRES_MS,
  SALT_ROUNDS,
  VERIFICATION_EXPIRES_MS,
} from '../auth.constants';
import type { SignUpDto } from '../dto/sign-up.dto';
import { AuthService, type RequestContext, type TokenPair } from './auth.service';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly authService: AuthService,
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
    const tokens = await this.authService.createAuthSession(user.id, rememberMe, ctx);
    return { user, tokens };
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

      const tokens = await this.authService.createAuthSession(user.id, false, ctx);
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

  async forgotPassword(email: string, callbackURL?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizedEmail } });

    if (!user) return; // prevent enumeration

    const accessSecret = this.configService.getOrThrow<string>('auth.accessSecret');
    const token = await this.jwtService.signAsync(
      { email: normalizedEmail, type: 'password_reset' },
      { secret: accessSecret, expiresIn: RESET_PASSWORD_EXPIRES_MS / 1000 },
    );

    const encodedCallback = encodeURIComponent(callbackURL ?? '/');
    const baseURL = this.configService.getOrThrow<string>('app.url');
    const url = `${baseURL}/reset-password?token=${token}&callbackURL=${encodedCallback}`;

    await this.mailerService.sendMail({
      to: normalizedEmail,
      subject: 'Reset your password',
      text: `Reset your password by clicking: ${url}`,
      html: `<p>Reset your password by clicking: <a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const accessSecret = this.configService.getOrThrow<string>('auth.accessSecret');

    let payload: { email?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ email?: string; type?: string }>(token, {
        secret: accessSecret,
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (payload.type !== 'password_reset' || !payload.email || typeof payload.email !== 'string') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const normalizedEmail = payload.email.toLowerCase();

    await this.dataSource.transaction(async (tx) => {
      const userRepo = tx.getRepository(User);
      const accountRepo = tx.getRepository(Account);

      const user = await userRepo.findOne({ where: { email: normalizedEmail } });
      if (!user) throw new BadRequestException('Invalid or expired reset token');

      const account = await accountRepo.findOne({
        where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
        select: { id: true, userId: true, providerId: true },
      });
      if (!account) throw new BadRequestException('No password account found');

      const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await accountRepo.update(account.id, { password: hashed });

      // Invalidate all refresh sessions to force re-login
      await tx.getRepository(RefreshSession).delete({ userId: user.id });
    });
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
