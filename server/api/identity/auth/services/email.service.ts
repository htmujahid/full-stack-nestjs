import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { RefreshSession } from '../entities/refresh-session.entity';
import { User } from '../../user/user.entity';
import {
  EMAIL_CHANGE_EXPIRES_MS,
  EMAIL_CHANGE_VERIFICATION_TYPE,
  EMAIL_VERIFICATION_TYPE,
  MAGIC_LINK_EXPIRES_MS,
  MAGIC_LINK_TYPE,
  VERIFICATION_EXPIRES_MS,
} from '../auth.constants';
import {
  AuthService,
} from './auth.service';
import type { RequestContext, TokenPair } from '../types';

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly authService: AuthService,
  ) {}

  /** Step 1: send a magic sign-in link to the email address */
  async sendSignInLink(
    email: string,
    callbackURL?: string,
    errorURL?: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizedEmail } });

    if (!user) return; // prevent enumeration

    const token = await this.jwtService.signAsync(
      { sub: user.id, email: normalizedEmail, type: MAGIC_LINK_TYPE },
      { expiresIn: MAGIC_LINK_EXPIRES_MS / 1000 },
    );

    const encodedCallback = encodeURIComponent(callbackURL ?? '/');
    const encodedError = encodeURIComponent(errorURL ?? '/auth/error');
    const baseURL = this.configService.getOrThrow<string>('app.url');
    const url = `${baseURL}/api/auth/verify-email-link?token=${token}&callbackURL=${encodedCallback}&errorURL=${encodedError}`;

    await this.mailerService.sendMail({
      to: normalizedEmail,
      subject: 'Your sign-in link',
      text: `Sign in by clicking: ${url}`,
      html: `<p>Sign in by clicking: <a href="${url}">${url}</a></p><p>This link expires in 15 minutes.</p>`,
    });
  }

  /** Step 2: verify the magic link token and issue an auth session */
  async verifySignInLink(
    token: string,
    ctx: RequestContext,
  ): Promise<
    { ok: true; user: User; tokens: TokenPair } | { ok: false; error: string }
  > {
    let payload: { sub?: string; email?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      return { ok: false, error: 'invalid_token' };
    }

    if (payload.type !== MAGIC_LINK_TYPE || !payload.sub || !payload.email) {
      return { ok: false, error: 'invalid_token' };
    }

    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: payload.sub } });
    if (!user) return { ok: false, error: 'user_not_found' };

    // Auto-verify email if not already verified
    if (!user.emailVerified) {
      await userRepo.update(user.id, { emailVerified: true });
      user.emailVerified = true;
    }

    const tokens = await this.authService.createAuthSession(
      user.id,
      user.role,
      false,
      ctx,
      'email',
    );
    return { ok: true, user, tokens };
  }

  // Pure JWT — no DB storage
  async verifyEmail(
    token: string,
    ctx: RequestContext,
  ): Promise<
    { ok: true; user: User; tokens: TokenPair } | { ok: false; error: string }
  > {
    let payload: { sub?: string; email?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      return { ok: false, error: 'invalid_token' };
    }

    if (payload.type !== EMAIL_VERIFICATION_TYPE || !payload.email) {
      return { ok: false, error: 'invalid_token' };
    }

    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email: payload.email } });
    if (!user) return { ok: false, error: 'user_not_found' };

    if (!user.emailVerified) {
      await userRepo.update(user.id, { emailVerified: true });
      user.emailVerified = true;
    }

    const tokens = await this.authService.createAuthSession(
      user.id,
      user.role,
      false,
      ctx,
      'password',
    );
    return { ok: true, user, tokens };
  }

  async resendVerificationEmail(
    email: string,
    callbackURL?: string,
    errorURL?: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizedEmail } });

    if (!user || user.emailVerified) return; // prevent enumeration
    await this.sendVerificationEmail(
      user.id,
      normalizedEmail,
      callbackURL,
      errorURL,
    );
  }

  async initiateEmailChange(
    userId: string,
    newEmail: string,
    callbackURL?: string,
    errorURL?: string,
  ): Promise<void> {
    const normalizedEmail = newEmail.toLowerCase().trim();

    const existing = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException('Email is already in use');

    const token = await this.jwtService.signAsync(
      {
        sub: userId,
        newEmail: normalizedEmail,
        type: EMAIL_CHANGE_VERIFICATION_TYPE,
      },
      { expiresIn: EMAIL_CHANGE_EXPIRES_MS / 1000 },
    );

    const encodedCallback = encodeURIComponent(callbackURL ?? '/');
    const encodedError = encodeURIComponent(errorURL ?? '/auth/error');
    const baseURL = this.configService.getOrThrow<string>('app.url');
    const url = `${baseURL}/api/auth/verify-email-change?token=${token}&callbackURL=${encodedCallback}&errorURL=${encodedError}`;

    await this.mailerService.sendMail({
      to: normalizedEmail,
      subject: 'Verify your new email address',
      text: `Confirm your new email by clicking: ${url}`,
      html: `<p>Confirm your new email by clicking: <a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
    });
  }

  async verifyEmailChange(
    token: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    let payload: { sub?: string; newEmail?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      return { ok: false, error: 'invalid_token' };
    }

    if (
      payload.type !== EMAIL_CHANGE_VERIFICATION_TYPE ||
      !payload.sub ||
      !payload.newEmail
    ) {
      return { ok: false, error: 'invalid_token' };
    }

    const userRepo = this.dataSource.getRepository(User);

    const conflict = await userRepo.findOne({
      where: { email: payload.newEmail },
    });
    if (conflict) return { ok: false, error: 'email_taken' };

    await this.dataSource.transaction(async (tx) => {
      await tx
        .getRepository(User)
        .update(payload.sub!, { email: payload.newEmail, emailVerified: true });
      // Invalidate all sessions — identity changed, force re-login
      await tx.getRepository(RefreshSession).delete({ userId: payload.sub });
    });

    return { ok: true };
  }

  async sendVerificationEmail(
    id: string,
    email: string,
    callbackURL?: string,
    errorURL?: string,
  ): Promise<void> {
    const token = await this.jwtService.signAsync(
      { sub: id, email, type: EMAIL_VERIFICATION_TYPE },
      { expiresIn: VERIFICATION_EXPIRES_MS / 1000 },
    );

    const encodedCallback = encodeURIComponent(callbackURL ?? '/');
    const encodedError = encodeURIComponent(errorURL ?? '/auth/error');
    const baseURL = this.configService.getOrThrow<string>('app.url');
    const url = `${baseURL}/api/auth/verify-email?token=${token}&callbackURL=${encodedCallback}&errorURL=${encodedError}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your email',
      text: `Verify your email by clicking: ${url}`,
      html: `<p>Verify your email by clicking: <a href="${url}">${url}</a></p>`,
    });
  }
}
