import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { Verification } from '../entities/verification.entity';
import { hashToken, signHmac, verifyHmac } from '../crypto.util';
import {
  TFA_PENDING_EXPIRES_MS,
  TRUST_DEVICE_EXPIRES_MS,
  TRUST_DEVICE_TYPE,
} from '../auth.constants';

@Injectable()
export class TwoFactorGateService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async createPendingToken(userId: string): Promise<string> {
    const secret = this.configService.getOrThrow<string>('auth.accessSecret');
    return this.jwtService.signAsync(
      { sub: userId, type: '2fa_pending' },
      { secret, expiresIn: TFA_PENDING_EXPIRES_MS / 1000 },
    );
  }

  async checkTrustDevice(
    cookieValue: string,
    userId: string,
  ): Promise<boolean> {
    const parts = cookieValue.split('.');
    if (parts.length !== 3) return false;
    const [cookieUserId, token, sig] = parts;
    if (cookieUserId !== userId) return false;

    const secret = this.configService.getOrThrow<string>('auth.accessSecret');
    if (!verifyHmac(secret, `${userId}.${token}`, sig)) return false;

    const tokenHash = hashToken(token);
    const record = await this.dataSource
      .getRepository(Verification)
      .findOne({ where: { identifier: `${TRUST_DEVICE_TYPE}:${tokenHash}` } });
    return !!(
      record &&
      record.value === userId &&
      record.expiresAt >= new Date()
    );
  }

  async rotateTrustDevice(
    cookieValue: string,
    userId: string,
  ): Promise<string> {
    const parts = cookieValue.split('.');
    if (parts.length === 3) {
      const oldHash = hashToken(parts[1]);
      await this.dataSource
        .getRepository(Verification)
        .delete({ identifier: `${TRUST_DEVICE_TYPE}:${oldHash}` });
    }
    return this.createTrustDeviceCookieValue(userId);
  }

  async createTrustDeviceCookieValue(userId: string): Promise<string> {
    const token = randomBytes(24).toString('hex');
    const tokenHash = hashToken(token);
    const verRepo = this.dataSource.getRepository(Verification);
    await verRepo.save(
      verRepo.create({
        identifier: `${TRUST_DEVICE_TYPE}:${tokenHash}`,
        value: userId,
        expiresAt: new Date(Date.now() + TRUST_DEVICE_EXPIRES_MS),
      }),
    );
    const secret = this.configService.getOrThrow<string>('auth.accessSecret');
    const sig = signHmac(secret, `${userId}.${token}`);
    return `${userId}.${token}.${sig}`;
  }
}
