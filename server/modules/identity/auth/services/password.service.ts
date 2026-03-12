import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Account } from '../entities/account.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { Verification } from '../entities/verification.entity';
import { User } from '../../user/user.entity';
import {
  CREDENTIAL_PROVIDER,
  RESET_PASSWORD_EXPIRES_MS,
  RESET_PASSWORD_IDENTIFIER_PREFIX,
  SALT_ROUNDS,
  VERIFICATION_EXPIRES_MS,
  EMAIL_VERIFICATION_TYPE,
} from '../auth.constants';
import type { SignUpDto } from '../dto/sign-up.dto';
import {
  AuthService,
  type RequestContext,
  type TokenPair,
} from './auth.service';

@Injectable()
export class PasswordService {
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

      const existing = await userRepo.findOne({
        where: { email: normalizedEmail },
      });
      if (existing) {
        throw new ConflictException('User already exists. Use another email.');
      }

      const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

      if (dto.username) {
        const existingUsername = await userRepo.findOne({
          where: { username: dto.username.toLowerCase().trim() },
        });
        if (existingUsername) {
          throw new ConflictException('Username is already taken.');
        }
      }

      if (dto.phone) {
        const existingPhone = await userRepo.findOne({
          where: { phone: dto.phone.trim() },
        });
        if (existingPhone) {
          throw new ConflictException('Phone number is already in use.');
        }
      }

      const user = userRepo.create({
        name: dto.name,
        email: normalizedEmail,
        username: dto.username ? dto.username.toLowerCase().trim() : null,
        phone: dto.phone ? dto.phone.trim() : null,
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
    const tokens = await this.authService.createAuthSession(
      user.id,
      rememberMe,
      ctx,
      'password',
    );
    return { user, tokens };
  }

  // Random opaque token stored in DB for password reset
  async forgotPassword(email: string, callbackURL?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizedEmail } });

    if (!user) {
      // Mitigate timing attacks: simulate work even when user doesn't exist
      randomUUID();
      await this.dataSource
        .getRepository(Verification)
        .findOne({ where: { identifier: 'dummy-reset-token' } });
      return;
    }

    const token = randomUUID();
    const identifier = `${RESET_PASSWORD_IDENTIFIER_PREFIX}${token}`;
    const verRepo = this.dataSource.getRepository(Verification);

    await verRepo.save(
      verRepo.create({
        identifier,
        value: user.id,
        expiresAt: new Date(Date.now() + RESET_PASSWORD_EXPIRES_MS),
      }),
    );

    const encodedCallback = encodeURIComponent(callbackURL ?? '/');
    const baseURL = this.configService.getOrThrow<string>('app.url');
    const url = `${baseURL}/api/auth/reset-password/${token}?callbackURL=${encodedCallback}`;

    await this.mailerService.sendMail({
      to: normalizedEmail,
      subject: 'Reset your password',
      text: `Reset your password by clicking: ${url}`,
      html: `<p>Reset your password by clicking: <a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
    });
  }

  async validateResetPasswordToken(token: string): Promise<boolean> {
    const identifier = `${RESET_PASSWORD_IDENTIFIER_PREFIX}${token}`;
    const record = await this.dataSource
      .getRepository(Verification)
      .findOne({ where: { identifier } });
    return !!(record && record.expiresAt >= new Date());
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const identifier = `${RESET_PASSWORD_IDENTIFIER_PREFIX}${token}`;
    const verRepo = this.dataSource.getRepository(Verification);
    const record = await verRepo.findOne({ where: { identifier } });

    if (!record || record.expiresAt < new Date()) {
      if (record) await verRepo.delete(record.id);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const userId = record.value;
    await verRepo.delete(record.id);

    await this.dataSource.transaction(async (tx) => {
      const accountRepo = tx.getRepository(Account);

      const account = await accountRepo.findOne({
        where: { userId, providerId: CREDENTIAL_PROVIDER },
        select: { id: true, userId: true, providerId: true },
      });
      if (!account) throw new BadRequestException('No password account found');

      const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await accountRepo.update(account.id, { password: hashed });

      // Invalidate all refresh sessions to force re-login
      await tx.getRepository(RefreshSession).delete({ userId });
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      const accountRepo = tx.getRepository(Account);

      const account = await accountRepo.findOne({
        where: { userId, providerId: CREDENTIAL_PROVIDER },
        select: { id: true, userId: true, providerId: true },
      });
      if (!account) throw new BadRequestException('No password account found');

      const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await accountRepo.update(account.id, { password: hashed });

      // Invalidate all refresh sessions to force re-login on other devices
      await tx.getRepository(RefreshSession).delete({ userId });
    });
  }

  private async sendVerificationEmail(
    email: string,
    callbackURL?: string,
  ): Promise<void> {
    const secret = this.configService.getOrThrow<string>('auth.accessSecret');
    const token = await this.jwtService.signAsync(
      { email, type: EMAIL_VERIFICATION_TYPE },
      { secret, expiresIn: VERIFICATION_EXPIRES_MS / 1000 },
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
