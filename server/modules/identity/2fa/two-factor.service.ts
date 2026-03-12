import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Like } from 'typeorm';
import { randomBytes, randomInt, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  TOTP,
  generateSecret,
  generateURI,
  NobleCryptoPlugin,
  ScureBase32Plugin,
} from 'otplib';
import { decrypt, encrypt, hashToken } from '../auth/crypto.util';
import { TwoFactor } from './two-factor.entity';
import { User } from '../user/user.entity';
import { Account } from '../auth/entities/account.entity';
import { Verification } from '../auth/entities/verification.entity';
import {
  AuthService,
  type RequestContext,
  type TokenPair,
} from '../auth/services/auth.service';
import { TwoFactorGateService } from '../auth/services/two-factor-gate.service';
import {
  CREDENTIAL_PROVIDER,
  BACKUP_CODE_COUNT,
  BACKUP_CODE_LENGTH,
  TOTP_DIGITS,
  TOTP_PERIOD,
  TFA_OTP_TYPE,
  TFA_OTP_EXPIRES_MS,
  OTP_MAX_ATTEMPTS,
  TRUST_DEVICE_TYPE,
} from '../auth/auth.constants';
import type { EnableTwoFactorDto } from './dto/enable-two-factor.dto';

function makeTOTP(secret: string, issuer?: string, label?: string): TOTP {
  return new TOTP({
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret,
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
    ...(issuer !== undefined ? { issuer } : {}),
    ...(label !== undefined ? { label } : {}),
  });
}

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    private readonly authService: AuthService,
    private readonly twoFactorGate: TwoFactorGateService,
  ) {}

  async enable(
    userId: string,
    dto: EnableTwoFactorDto,
  ): Promise<{ totpURI: string; backupCodes: string[] }> {
    await this.requireCredentialAccount(userId, dto.password);

    const encKey = this.configService.getOrThrow<string>('auth.accessSecret');
    const appName = this.configService.get<string>('app.name') ?? 'crude';
    const issuer = dto.issuer ?? appName;
    const secret = generateSecret({ length: 20 });
    const { plainCodes, hashedCodesJson } = this.generateBackupCodeSet();
    const encryptedSecret = encrypt(secret, encKey);
    const tfRepo = this.dataSource.getRepository(TwoFactor);
    const existing = await tfRepo.findOne({ where: { userId } });
    if (existing) {
      await this.dataSource.transaction(async (tx) => {
        await tx.getRepository(TwoFactor).update(existing.id, {
          secret: encryptedSecret,
          backupCodes: hashedCodesJson,
          lastUsedPeriod: null,
        });
        // Reset flag so the new secret must be confirmed via enable/verify
        await tx
          .getRepository(User)
          .update(userId, { twoFactorEnabled: false });
      });
    } else {
      await tfRepo.save(
        tfRepo.create({
          userId,
          secret: encryptedSecret,
          backupCodes: hashedCodesJson,
        }),
      );
    }

    const user = await this.dataSource
      .getRepository(User)
      .findOneOrFail({ where: { id: userId } });
    const totpURI = generateURI({
      label: user.email,
      issuer,
      secret,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
    });

    return { totpURI, backupCodes: plainCodes };
  }

  async verifyEnableTotp(userId: string, code: string): Promise<void> {
    const { record, secret } = await this.getTwoFactorRecord(userId);
    const totp = makeTOTP(secret);
    const currentPeriod = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    if (
      record.lastUsedPeriod !== null &&
      record.lastUsedPeriod >= currentPeriod
    ) {
      throw new UnauthorizedException('TOTP code already used');
    }
    const result = await totp.verify(code, { epochTolerance: TOTP_PERIOD });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP code');
    await this.dataSource.transaction(async (tx) => {
      await tx
        .getRepository(TwoFactor)
        .update(record.id, { lastUsedPeriod: currentPeriod });
      await tx.getRepository(User).update(userId, { twoFactorEnabled: true });
    });
  }

  async disable(userId: string, password: string): Promise<void> {
    await this.requireCredentialAccount(userId, password);

    await this.dataSource.transaction(async (tx) => {
      await tx.getRepository(TwoFactor).delete({ userId });
      await tx.getRepository(User).update(userId, { twoFactorEnabled: false });
      const verifications = await tx.getRepository(Verification).find({
        where: {
          identifier: Like(`${TRUST_DEVICE_TYPE}:%`),
          value: userId,
        },
      });
      await tx.getRepository(Verification).remove(verifications);
    });
  }

  async getTotpUri(userId: string, password: string): Promise<string> {
    await this.requireCredentialAccount(userId, password);
    const { secret } = await this.getTwoFactorRecord(userId);
    const appName = this.configService.get<string>('app.name') ?? 'crude';
    const user = await this.dataSource
      .getRepository(User)
      .findOneOrFail({ where: { id: userId } });
    return generateURI({
      label: user.email,
      issuer: appName,
      secret,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
    });
  }

  async verifyTotp(
    userId: string,
    code: string,
    trustDevice: boolean,
    ctx: RequestContext,
  ): Promise<{ tokens: TokenPair; trustCookieValue: string | null }> {
    const { record, secret } = await this.getTwoFactorRecord(userId);
    const totp = makeTOTP(secret);
    const currentPeriod = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
    if (
      record.lastUsedPeriod !== null &&
      record.lastUsedPeriod >= currentPeriod
    ) {
      throw new UnauthorizedException('TOTP code already used');
    }
    const result = await totp.verify(code, { epochTolerance: TOTP_PERIOD });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP code');
    await this.dataSource
      .getRepository(TwoFactor)
      .update(record.id, { lastUsedPeriod: currentPeriod });

    const tokens = await this.authService.createAuthSession(
      userId,
      false,
      ctx,
      'password',
    );
    const trustCookieValue = trustDevice
      ? await this.twoFactorGate.createTrustDeviceCookieValue(userId)
      : null;
    return { tokens, trustCookieValue };
  }

  async sendOtp(userId: string): Promise<void> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneOrFail({ where: { id: userId } });

    if (!user.twoFactorEnabled)
      throw new UnauthorizedException('2FA is not enabled');

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const verRepo = this.dataSource.getRepository(Verification);

    await verRepo.delete({ identifier: `${TFA_OTP_TYPE}:${userId}` });

    await verRepo.save(
      verRepo.create({
        identifier: `${TFA_OTP_TYPE}:${userId}`,
        value: `${hashToken(code)}:0`, // hash:attemptCount
        expiresAt: new Date(Date.now() + TFA_OTP_EXPIRES_MS),
      }),
    );

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Your verification code',
      text: `Your 2FA code is: ${code}. It expires in 3 minutes.`,
      html: `<p>Your 2FA code is: <strong>${code}</strong></p><p>Expires in 3 minutes.</p>`,
    });
  }

  async verifyOtp(
    userId: string,
    code: string,
    trustDevice: boolean,
    ctx: RequestContext,
  ): Promise<{ tokens: TokenPair; trustCookieValue: string | null }> {
    const verRepo = this.dataSource.getRepository(Verification);
    const record = await verRepo.findOne({
      where: { identifier: `${TFA_OTP_TYPE}:${userId}` },
    });

    if (!record || record.expiresAt < new Date()) {
      if (record) await verRepo.delete(record.id);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const [storedHash, attemptStr] = record.value.split(':');
    const attempts = parseInt(attemptStr ?? '0', 10);

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await verRepo.delete(record.id);
      throw new UnauthorizedException('Too many failed attempts');
    }

    const incomingHash = hashToken(code);
    const a = Buffer.from(incomingHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    const match = a.length === b.length && timingSafeEqual(a, b);

    if (!match) {
      await verRepo.update(record.id, {
        value: `${storedHash}:${attempts + 1}`,
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await verRepo.delete(record.id);

    const tokens = await this.authService.createAuthSession(
      userId,
      false,
      ctx,
      'password',
    );
    const trustCookieValue = trustDevice
      ? await this.twoFactorGate.createTrustDeviceCookieValue(userId)
      : null;
    return { tokens, trustCookieValue };
  }

  async generateBackupCodes(
    userId: string,
    password: string,
  ): Promise<string[]> {
    await this.requireCredentialAccount(userId, password);
    const { plainCodes, hashedCodesJson } = this.generateBackupCodeSet();
    await this.dataSource
      .getRepository(TwoFactor)
      .update({ userId }, { backupCodes: hashedCodesJson });
    return plainCodes;
  }

  async verifyBackupCode(
    userId: string,
    code: string,
    trustDevice: boolean,
    ctx: RequestContext,
  ): Promise<{ tokens: TokenPair; trustCookieValue: string | null }> {
    const tfRepo = this.dataSource.getRepository(TwoFactor);
    const record = await tfRepo.findOne({
      where: { userId },
      select: ['id', 'userId', 'backupCodes'],
    });

    if (!record?.backupCodes)
      throw new UnauthorizedException('No backup codes found');

    const storedHashes: string[] = JSON.parse(record.backupCodes) as string[];
    const codeHash = hashToken(code);

    let matchIndex = -1;
    for (let i = 0; i < storedHashes.length; i++) {
      const a = Buffer.from(codeHash, 'hex');
      const b = Buffer.from(storedHashes[i], 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1)
      throw new UnauthorizedException('Invalid backup code');

    storedHashes.splice(matchIndex, 1);
    await tfRepo.update(record.id, {
      backupCodes: JSON.stringify(storedHashes),
    });

    const tokens = await this.authService.createAuthSession(
      userId,
      false,
      ctx,
      'password',
    );
    const trustCookieValue = trustDevice
      ? await this.twoFactorGate.createTrustDeviceCookieValue(userId)
      : null;
    return { tokens, trustCookieValue };
  }

  private async requireCredentialAccount(
    userId: string,
    password: string,
  ): Promise<void> {
    const account = await this.dataSource.getRepository(Account).findOne({
      where: { userId, providerId: CREDENTIAL_PROVIDER },
      select: { id: true, password: true },
    });
    if (!account?.password)
      throw new ForbiddenException('No password account found');
    const valid = await bcrypt.compare(password, account.password);
    if (!valid) throw new UnauthorizedException('Invalid password');
  }

  private async getTwoFactorRecord(
    userId: string,
  ): Promise<{ record: TwoFactor; secret: string }> {
    const record = await this.dataSource.getRepository(TwoFactor).findOne({
      where: { userId },
      select: { id: true, userId: true, secret: true, lastUsedPeriod: true },
    });
    if (!record) throw new ForbiddenException('2FA not set up');
    const encKey = this.configService.getOrThrow<string>('auth.accessSecret');
    return { record, secret: decrypt(record.secret, encKey) };
  }

  private generateBackupCodeSet(): {
    plainCodes: string[];
    hashedCodesJson: string;
  } {
    const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
      const raw = this.randomAlphanumeric(BACKUP_CODE_LENGTH);
      return `${raw.slice(0, 5)}-${raw.slice(5)}`; // XXXXX-XXXXX format (~60 bits)
    });
    const hashes = plainCodes.map((c) => hashToken(c));
    return { plainCodes, hashedCodesJson: JSON.stringify(hashes) };
  }

  private randomAlphanumeric(length: number): string {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    // 248 = largest multiple of 62 fitting in a byte — eliminates modulo bias
    const result: string[] = [];
    while (result.length < length) {
      const bytes = randomBytes(length - result.length + 4);
      for (const b of bytes) {
        if (result.length >= length) break;
        if (b < 248) result.push(chars[b % 62]);
      }
    }
    return result.join('');
  }
}
