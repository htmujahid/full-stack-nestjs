import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { Verification } from '../entities/verification.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { User } from '../../user/user.entity';
import {
  PHONE_CHANGE_IDENTIFIER_PREFIX,
  PHONE_OTP_EXPIRES_MS,
  PHONE_OTP_IDENTIFIER_PREFIX,
  PHONE_OTP_LENGTH,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_VERIFY_IDENTIFIER_PREFIX,
} from '../auth.constants';
import {
  AuthService,
  type RequestContext,
  type TokenPair,
} from './auth.service';

// OTP record stored in Verification.value as JSON
interface OtpRecord {
  hash: string;
  attempts: number;
  userId?: string;
}

@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  /** Step 1: request OTP to sign in via phone */
  async sendSignInOtp(phone: string): Promise<void> {
    const normalizedPhone = phone.trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { phone: normalizedPhone } });

    if (!user) return; // prevent enumeration

    await this.upsertOtp(
      PHONE_OTP_IDENTIFIER_PREFIX + normalizedPhone,
      user.id,
    );
  }

  /** Step 2: verify OTP and issue tokens */
  async verifySignInOtp(
    phone: string,
    code: string,
    rememberMe: boolean,
    ctx: RequestContext,
  ): Promise<{ user: User; tokens: TokenPair }> {
    const normalizedPhone = phone.trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { phone: normalizedPhone } });

    if (!user) throw new UnauthorizedException('Invalid phone or code');

    await this.consumeOtp(PHONE_OTP_IDENTIFIER_PREFIX + normalizedPhone, code);

    if (!user.phoneVerified) {
      await this.dataSource
        .getRepository(User)
        .update(user.id, { phoneVerified: true });
      user.phoneVerified = true;
    }

    const tokens = await this.authService.createAuthSession(
      user.id,
      user.role,
      rememberMe,
      ctx,
      'phone',
    );
    return { user, tokens };
  }

  /** Send an OTP to verify ownership of a phone number */
  async sendVerificationOtp(phone: string): Promise<void> {
    const normalizedPhone = phone.trim();

    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { phone: normalizedPhone } });
    if (!user || user.phoneVerified) return; // prevent enumeration

    await this.upsertOtp(PHONE_VERIFY_IDENTIFIER_PREFIX + normalizedPhone);
  }

  /** Verify the OTP and mark the phone as verified */
  async verifyPhone(
    phone: string,
    code: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const normalizedPhone = phone.trim();
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { phone: normalizedPhone } });

    if (!user) return { ok: false, error: 'user_not_found' };
    if (user.phoneVerified) return { ok: true };

    try {
      await this.consumeOtp(
        PHONE_VERIFY_IDENTIFIER_PREFIX + normalizedPhone,
        code,
      );
    } catch {
      return { ok: false, error: 'invalid_code' };
    }

    await this.dataSource
      .getRepository(User)
      .update(user.id, { phoneVerified: true });

    return { ok: true };
  }

  /** Initiate a phone number change — sends OTP to the new number */
  async initiatePhoneChange(userId: string, newPhone: string): Promise<void> {
    const normalizedPhone = newPhone.trim();

    const existing = await this.dataSource
      .getRepository(User)
      .findOne({ where: { phone: normalizedPhone } });
    if (existing) throw new ConflictException('Phone number is already in use');

    await this.upsertOtp(
      PHONE_CHANGE_IDENTIFIER_PREFIX + normalizedPhone,
      userId,
    );
  }

  /** Verify OTP and apply the phone number change */
  async verifyPhoneChange(
    newPhone: string,
    code: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const normalizedPhone = newPhone.trim();
    const identifier = PHONE_CHANGE_IDENTIFIER_PREFIX + normalizedPhone;

    const record = await this.dataSource
      .getRepository(Verification)
      .findOne({ where: { identifier } });

    if (!record) return { ok: false, error: 'code_not_found' };

    const stored: OtpRecord = JSON.parse(record.value) as OtpRecord;
    const userId = stored.userId;
    if (!userId) return { ok: false, error: 'invalid_record' };

    try {
      await this.consumeOtp(identifier, code);
    } catch {
      return { ok: false, error: 'invalid_code' };
    }

    await this.dataSource.transaction(async (tx) => {
      await tx
        .getRepository(User)
        .update(userId, { phone: normalizedPhone, phoneVerified: true });
      // Invalidate all sessions — identity changed, force re-login
      await tx.getRepository(RefreshSession).delete({ userId });
    });

    return { ok: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateOtp(): string {
    return String(randomInt(0, 10 ** PHONE_OTP_LENGTH)).padStart(
      PHONE_OTP_LENGTH,
      '0',
    );
  }

  private async upsertOtp(identifier: string, userId?: string): Promise<void> {
    const otp = this.generateOtp();
    const verRepo = this.dataSource.getRepository(Verification);

    // Remove any existing OTP for this identifier before issuing a new one
    await verRepo.delete({ identifier });

    const record: OtpRecord = {
      hash: otp,
      attempts: 0,
      ...(userId && { userId }),
    };
    await verRepo.save(
      verRepo.create({
        identifier,
        value: JSON.stringify(record),
        expiresAt: new Date(Date.now() + PHONE_OTP_EXPIRES_MS),
      }),
    );

    // TODO: replace with a real SMS provider (e.g. Twilio, AWS SNS)
    this.logger.log(`[SMS] OTP for ${identifier}: ${otp}`);
  }

  private async consumeOtp(identifier: string, code: string): Promise<void> {
    const verRepo = this.dataSource.getRepository(Verification);
    const record = await verRepo.findOne({ where: { identifier } });

    if (!record || record.expiresAt < new Date()) {
      if (record) await verRepo.delete(record.id);
      throw new UnauthorizedException('Code expired or not found');
    }

    const stored: OtpRecord = JSON.parse(record.value) as OtpRecord;

    if (stored.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await verRepo.delete(record.id);
      throw new BadRequestException('Too many attempts. Request a new code.');
    }

    if (stored.hash !== code) {
      stored.attempts += 1;
      await verRepo.update(record.id, {
        value: JSON.stringify(stored),
      });
      throw new UnauthorizedException('Invalid code');
    }

    await verRepo.delete(record.id);
  }
}
