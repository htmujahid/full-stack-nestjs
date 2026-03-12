import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TwoFactorService } from './two-factor.service';
import { TwoFactor } from './two-factor.entity';
import { User } from '../user/user.entity';
import { Account } from '../account/account.entity';
import { Verification } from '../auth/entities/verification.entity';
import { AuthService, type RequestContext, type TokenPair } from '../auth/services/auth.service';
import { TwoFactorGateService } from '../auth/services/two-factor-gate.service';
import { mockDataSource, mockRepository } from '../../../mocks/db.mock';
import {
  CREDENTIAL_PROVIDER,
  TFA_OTP_TYPE,
  OTP_MAX_ATTEMPTS,
  TOTP_PERIOD,
  TRUST_DEVICE_TYPE,
} from '../auth/auth.constants';
import type { EnableTwoFactorDto } from './dto/enable-two-factor.dto';

// ─── module-level mocks ──────────────────────────────────────────────────────

jest.mock('bcrypt');
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('BASE32SECRET'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/test'),
  NobleCryptoPlugin: jest.fn(),
  ScureBase32Plugin: jest.fn(),
  TOTP: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));
jest.mock('../auth/crypto.util', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-secret'),
  decrypt: jest.fn().mockReturnValue('DECRYPTED-SECRET'),
  // Default: return a valid 64-char hex string based on the first char of input
  hashToken: jest.fn((v: string) => (v[0] === 'c' ? 'c'.repeat(64) : 'a'.repeat(64))),
  verifyToken: jest.fn(),
  signHmac: jest.fn(),
  verifyHmac: jest.fn(),
}));

// Pull mock references after jest.mock() calls are hoisted
import { encrypt, decrypt, hashToken } from '../auth/crypto.util';
import { generateSecret, generateURI, TOTP } from 'otplib';

const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockEncrypt = encrypt as jest.Mock;
const mockDecrypt = decrypt as jest.Mock;
const mockHashToken = hashToken as jest.Mock;
const mockGenerateSecret = generateSecret as jest.Mock;
const mockGenerateURI = generateURI as jest.Mock;
const MockTOTP = TOTP as jest.Mock;

// ─── hex hash constants (valid 64-char hex for timingSafeEqual) ───────────────

/** Hash of the "correct" value — used as the stored hash */
const HASH_CORRECT = 'a'.repeat(64);
/** Hash of a "wrong" value — distinct from HASH_CORRECT */
const HASH_WRONG = 'b'.repeat(64);

// ─── fixed timestamp ─────────────────────────────────────────────────────────

const NOW = 2_000_000_000_000;

// ─── factory helpers ─────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    twoFactorEnabled: true,
    ...overrides,
  }) as User;

const makeAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'account-uuid',
    userId: 'user-uuid',
    providerId: CREDENTIAL_PROVIDER,
    accountId: 'user-uuid',
    password: 'hashed-pw',
    ...overrides,
  }) as Account;

const makeTwoFactor = (overrides: Partial<TwoFactor> = {}): TwoFactor =>
  ({
    id: 'tf-uuid',
    userId: 'user-uuid',
    secret: 'encrypted-secret',
    backupCodes: null,
    lastUsedPeriod: null,
    ...overrides,
  }) as TwoFactor;

const makeVerification = (overrides: Partial<Verification> = {}): Verification =>
  ({
    id: 'ver-uuid',
    identifier: `${TFA_OTP_TYPE}:user-uuid`,
    value: `${HASH_CORRECT}:0`,
    expiresAt: new Date(NOW + 60_000),
    ...overrides,
  }) as Verification;

const makeTokenPair = (): TokenPair => ({
  accessToken: 'access',
  refreshToken: 'refresh',
  refreshExpiresAt: new Date(NOW + 86_400_000),
});

const makeCtx = (): RequestContext => ({ ip: '127.0.0.1', userAgent: 'jest' });

const makeEnableDto = (overrides: Partial<EnableTwoFactorDto> = {}): EnableTwoFactorDto => ({
  password: 'my-password',
  ...overrides,
});

// ─── suite ───────────────────────────────────────────────────────────────────

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let configService: { getOrThrow: jest.Mock; get: jest.Mock };
  let mailerService: { sendMail: jest.Mock };
  let authService: { createAuthSession: jest.Mock };
  let twoFactorGate: { createTrustDeviceCookieValue: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    configService = {
      getOrThrow: jest.fn().mockReturnValue('enc-secret'),
      get: jest.fn().mockReturnValue('crude'),
    };
    mailerService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    authService = { createAuthSession: jest.fn().mockResolvedValue(makeTokenPair()) };
    twoFactorGate = { createTrustDeviceCookieValue: jest.fn().mockResolvedValue('trust-cookie') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: MailerService, useValue: mailerService },
        { provide: AuthService, useValue: authService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    }).compile();

    service = module.get(TwoFactorService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ─── enable ─────────────────────────────────────────────────────────────────

  describe('enable', () => {
    it('returns totpURI and backupCodes on first-time setup (no existing record)', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);
      tfRepo.create.mockReturnValue(makeTwoFactor());
      tfRepo.save.mockResolvedValue(makeTwoFactor());

      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        if (entity === User) return userRepo;
        return mockRepository();
      });

      mockGenerateURI.mockReturnValue('otpauth://totp/test@example.com');

      const result = await service.enable('user-uuid', makeEnableDto());

      expect(result.totpURI).toBe('otpauth://totp/test@example.com');
      expect(Array.isArray(result.backupCodes)).toBe(true);
      expect(result.backupCodes.length).toBeGreaterThan(0);
    });

    it('creates a new TwoFactor record when none exists', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);
      tfRepo.create.mockReturnValue(makeTwoFactor());
      tfRepo.save.mockResolvedValue(makeTwoFactor());

      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        if (entity === User) return userRepo;
        return mockRepository();
      });

      await service.enable('user-uuid', makeEnableDto());

      expect(tfRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-uuid', secret: 'encrypted-secret' }),
      );
      expect(tfRepo.save).toHaveBeenCalled();
    });

    it('updates existing TwoFactor record and resets twoFactorEnabled via transaction', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor());

      const txTfRepo = mockRepository();
      txTfRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      const txUserRepo = mockRepository();
      txUserRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === TwoFactor) return txTfRepo;
            if (entity === User) return txUserRepo;
            return mockRepository();
          }),
        };
        return cb(tx);
      });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        if (entity === User) return userRepo;
        return mockRepository();
      });

      await service.enable('user-uuid', makeEnableDto());

      expect(txTfRepo.update).toHaveBeenCalledWith(
        'tf-uuid',
        expect.objectContaining({ secret: 'encrypted-secret', lastUsedPeriod: null }),
      );
      expect(txUserRepo.update).toHaveBeenCalledWith('user-uuid', { twoFactorEnabled: false });
    });

    it('throws ForbiddenException when no credential account is found', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.enable('user-uuid', makeEnableDto())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(false);

      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.enable('user-uuid', makeEnableDto())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('uses custom issuer from dto when provided', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);
      tfRepo.create.mockReturnValue(makeTwoFactor());
      tfRepo.save.mockResolvedValue(makeTwoFactor());

      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        if (entity === User) return userRepo;
        return mockRepository();
      });

      await service.enable('user-uuid', makeEnableDto({ issuer: 'MyApp' }));

      expect(mockGenerateURI).toHaveBeenCalledWith(
        expect.objectContaining({ issuer: 'MyApp' }),
      );
    });
  });

  // ─── verifyEnableTotp ────────────────────────────────────────────────────────

  describe('verifyEnableTotp', () => {
    const currentPeriod = Math.floor(NOW / 1000 / TOTP_PERIOD);

    it('sets twoFactorEnabled=true and updates lastUsedPeriod on valid code', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: null }));

      const txTfRepo = mockRepository();
      txTfRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      const txUserRepo = mockRepository();
      txUserRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === TwoFactor) return txTfRepo;
            if (entity === User) return txUserRepo;
            return mockRepository();
          }),
        };
        return cb(tx);
      });

      const mockTotpInstance = { verify: jest.fn().mockResolvedValue({ valid: true }) };
      MockTOTP.mockImplementationOnce(() => mockTotpInstance);

      await service.verifyEnableTotp('user-uuid', '123456');

      expect(txTfRepo.update).toHaveBeenCalledWith('tf-uuid', { lastUsedPeriod: currentPeriod });
      expect(txUserRepo.update).toHaveBeenCalledWith('user-uuid', { twoFactorEnabled: true });
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: null }));

      dataSource.getRepository.mockReturnValue(tfRepo);

      const mockTotpInstance = { verify: jest.fn().mockResolvedValue({ valid: false }) };
      MockTOTP.mockImplementationOnce(() => mockTotpInstance);

      await expect(service.verifyEnableTotp('user-uuid', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP period has already been used', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: currentPeriod }));

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(service.verifyEnableTotp('user-uuid', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when no TwoFactor record is found', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(service.verifyEnableTotp('user-uuid', '123456')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── disable ─────────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('deletes TwoFactor, resets twoFactorEnabled, removes trust verifications in transaction', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const txTfRepo = mockRepository();
      txTfRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const txUserRepo = mockRepository();
      txUserRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txVerRepo = mockRepository();
      txVerRepo.find.mockResolvedValue([makeVerification()]);
      const txVerRemove = jest.fn().mockResolvedValue(undefined);
      (txVerRepo as typeof txVerRepo & { remove: jest.Mock }).remove = txVerRemove;

      dataSource.getRepository.mockReturnValue(accountRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === TwoFactor) return txTfRepo;
            if (entity === User) return txUserRepo;
            if (entity === Verification) return txVerRepo;
            return mockRepository();
          }),
        };
        return cb(tx);
      });

      await service.disable('user-uuid', 'password');

      expect(txTfRepo.delete).toHaveBeenCalledWith({ userId: 'user-uuid' });
      expect(txUserRepo.update).toHaveBeenCalledWith('user-uuid', { twoFactorEnabled: false });
      expect(txVerRemove).toHaveBeenCalled();
    });

    it('throws ForbiddenException when no credential account is found', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.disable('user-uuid', 'password')).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(false);
      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.disable('user-uuid', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('filters trust-device verifications by value=userId inside transaction', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const txVerRepo = mockRepository();
      txVerRepo.find.mockResolvedValue([]);
      const txVerRemove = jest.fn().mockResolvedValue(undefined);
      (txVerRepo as typeof txVerRepo & { remove: jest.Mock }).remove = txVerRemove;

      dataSource.getRepository.mockReturnValue(accountRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Verification) return txVerRepo;
            return mockRepository();
          }),
        };
        return cb(tx);
      });

      await service.disable('user-uuid', 'password');

      expect(txVerRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ value: 'user-uuid' }),
        }),
      );
    });
  });

  // ─── getTotpUri ──────────────────────────────────────────────────────────────

  describe('getTotpUri', () => {
    it('returns the TOTP URI after verifying password', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor());

      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        if (entity === User) return userRepo;
        return mockRepository();
      });

      mockGenerateURI.mockReturnValue('otpauth://totp/label');

      const result = await service.getTotpUri('user-uuid', 'password');

      expect(result).toBe('otpauth://totp/label');
    });

    it('decrypts the secret before generating the URI', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ secret: 'encrypted-secret' }));

      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        if (entity === User) return userRepo;
        return mockRepository();
      });

      mockDecrypt.mockReturnValue('PLAINTEXT-SECRET');

      await service.getTotpUri('user-uuid', 'password');

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted-secret', 'enc-secret');
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(false);
      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.getTotpUri('user-uuid', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when no TwoFactor record exists', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        return mockRepository();
      });

      await expect(service.getTotpUri('user-uuid', 'password')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── verifyTotp ──────────────────────────────────────────────────────────────

  describe('verifyTotp', () => {
    const currentPeriod = Math.floor(NOW / 1000 / TOTP_PERIOD);

    it('returns tokens and null trustCookieValue when trustDevice=false', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: null }));
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);

      const mockTotpInstance = { verify: jest.fn().mockResolvedValue({ valid: true }) };
      MockTOTP.mockImplementationOnce(() => mockTotpInstance);

      const result = await service.verifyTotp('user-uuid', '123456', false, makeCtx());

      expect(result.tokens).toEqual(makeTokenPair());
      expect(result.trustCookieValue).toBeNull();
      expect(twoFactorGate.createTrustDeviceCookieValue).not.toHaveBeenCalled();
    });

    it('returns a trustCookieValue when trustDevice=true', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: null }));
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);

      const mockTotpInstance = { verify: jest.fn().mockResolvedValue({ valid: true }) };
      MockTOTP.mockImplementationOnce(() => mockTotpInstance);

      const result = await service.verifyTotp('user-uuid', '123456', true, makeCtx());

      expect(result.trustCookieValue).toBe('trust-cookie');
      expect(twoFactorGate.createTrustDeviceCookieValue).toHaveBeenCalledWith('user-uuid');
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: null }));

      dataSource.getRepository.mockReturnValue(tfRepo);

      const mockTotpInstance = { verify: jest.fn().mockResolvedValue({ valid: false }) };
      MockTOTP.mockImplementationOnce(() => mockTotpInstance);

      await expect(service.verifyTotp('user-uuid', '000000', false, makeCtx())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP period has already been used (replay)', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: currentPeriod }));

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(service.verifyTotp('user-uuid', '123456', false, makeCtx())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('updates lastUsedPeriod after successful verification', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ lastUsedPeriod: null }));
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);

      const mockTotpInstance = { verify: jest.fn().mockResolvedValue({ valid: true }) };
      MockTOTP.mockImplementationOnce(() => mockTotpInstance);

      await service.verifyTotp('user-uuid', '123456', false, makeCtx());

      expect(tfRepo.update).toHaveBeenCalledWith('tf-uuid', { lastUsedPeriod: currentPeriod });
    });

    it('throws ForbiddenException when no TwoFactor record exists', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(service.verifyTotp('user-uuid', '123456', false, makeCtx())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── sendOtp ─────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('deletes any old OTP, saves a new hashed OTP, and sends email', async () => {
      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser({ twoFactorEnabled: true }));

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        if (entity === Verification) return verRepo;
        return mockRepository();
      });

      await service.sendOtp('user-uuid');

      expect(verRepo.delete).toHaveBeenCalledWith({ identifier: `${TFA_OTP_TYPE}:user-uuid` });
      expect(verRepo.save).toHaveBeenCalled();
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Your verification code',
        }),
      );
    });

    it('throws UnauthorizedException when 2FA is not enabled for the user', async () => {
      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser({ twoFactorEnabled: false }));

      dataSource.getRepository.mockReturnValue(userRepo);

      await expect(service.sendOtp('user-uuid')).rejects.toThrow(UnauthorizedException);
    });

    it('saves OTP with correct expiry timestamp', async () => {
      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser({ twoFactorEnabled: true }));

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        if (entity === Verification) return verRepo;
        return mockRepository();
      });

      await service.sendOtp('user-uuid');

      expect(verRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(NOW + 3 * 60 * 1000),
        }),
      );
    });

    it('stores value in hash:0 format', async () => {
      const userRepo = mockRepository();
      userRepo.findOneOrFail.mockResolvedValue(makeUser({ twoFactorEnabled: true }));

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        if (entity === Verification) return verRepo;
        return mockRepository();
      });

      await service.sendOtp('user-uuid');

      const createArg = verRepo.create.mock.calls[0][0] as { value: string };
      expect(createArg.value).toMatch(/^.+:0$/);
    });
  });

  // ─── verifyOtp ───────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('returns tokens on correct OTP code', async () => {
      // The service hashes the incoming code; we return HASH_CORRECT so it matches the stored value
      mockHashToken.mockReturnValue(HASH_CORRECT);

      const record = makeVerification({ value: `${HASH_CORRECT}:0` });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.verifyOtp('user-uuid', '123456', false, makeCtx());

      expect(result.tokens).toEqual(makeTokenPair());
      expect(verRepo.delete).toHaveBeenCalledWith(record.id);
    });

    it('throws UnauthorizedException when OTP record is not found', async () => {
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(service.verifyOtp('user-uuid', '123456', false, makeCtx())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException and deletes record when OTP has expired', async () => {
      const record = makeVerification({ expiresAt: new Date(NOW - 1) });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(service.verifyOtp('user-uuid', '123456', false, makeCtx())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(verRepo.delete).toHaveBeenCalledWith(record.id);
    });

    it('throws UnauthorizedException and deletes record when max attempts exceeded', async () => {
      const record = makeVerification({ value: `${HASH_CORRECT}:${OTP_MAX_ATTEMPTS}` });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(service.verifyOtp('user-uuid', 'whatever', false, makeCtx())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(verRepo.delete).toHaveBeenCalledWith(record.id);
    });

    it('increments attempt count and throws when OTP is wrong but attempts remain', async () => {
      // Stored hash is HASH_CORRECT; incoming code hashes to HASH_WRONG — no match
      mockHashToken.mockReturnValue(HASH_WRONG);

      const record = makeVerification({ value: `${HASH_CORRECT}:1` });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      await expect(service.verifyOtp('user-uuid', 'wrong', false, makeCtx())).rejects.toThrow(
        UnauthorizedException,
      );

      expect(verRepo.update).toHaveBeenCalledWith(
        record.id,
        expect.objectContaining({ value: `${HASH_CORRECT}:2` }),
      );
    });

    it('creates trust cookie when trustDevice=true and code is correct', async () => {
      mockHashToken.mockReturnValue(HASH_CORRECT);

      const record = makeVerification({ value: `${HASH_CORRECT}:0` });
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(record);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.verifyOtp('user-uuid', '123456', true, makeCtx());

      expect(result.trustCookieValue).toBe('trust-cookie');
      expect(twoFactorGate.createTrustDeviceCookieValue).toHaveBeenCalledWith('user-uuid');
    });
  });

  // ─── generateBackupCodes ─────────────────────────────────────────────────────

  describe('generateBackupCodes', () => {
    it('returns new backup codes and updates TwoFactor record after password verification', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        return mockRepository();
      });

      const result = await service.generateBackupCodes('user-uuid', 'password');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(tfRepo.update).toHaveBeenCalledWith(
        { userId: 'user-uuid' },
        expect.objectContaining({ backupCodes: expect.any(String) }),
      );
    });

    it('throws ForbiddenException when no credential account is found', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.generateBackupCodes('user-uuid', 'password')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(false);
      dataSource.getRepository.mockReturnValue(accountRepo);

      await expect(service.generateBackupCodes('user-uuid', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('saves backup codes as a JSON array string', async () => {
      const accountRepo = mockRepository();
      accountRepo.findOne.mockResolvedValue(makeAccount());
      mockBcryptCompare.mockResolvedValue(true);

      const tfRepo = mockRepository();
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === Account) return accountRepo;
        if (entity === TwoFactor) return tfRepo;
        return mockRepository();
      });

      await service.generateBackupCodes('user-uuid', 'password');

      const updateArg = tfRepo.update.mock.calls[0][1] as { backupCodes: string };
      const parsed: unknown = JSON.parse(updateArg.backupCodes);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  // ─── verifyBackupCode ────────────────────────────────────────────────────────

  describe('verifyBackupCode', () => {
    it('returns tokens after consuming a valid backup code', async () => {
      // The service calls hashToken(code) then compares with stored hashes
      mockHashToken.mockReturnValue(HASH_CORRECT);

      const backupCodes = JSON.stringify([HASH_CORRECT, HASH_WRONG]);
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ backupCodes }));
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);

      const result = await service.verifyBackupCode('user-uuid', 'AAAAA-BBBBB', false, makeCtx());

      expect(result.tokens).toEqual(makeTokenPair());
    });

    it('removes the used backup code from the stored list', async () => {
      mockHashToken.mockReturnValue(HASH_CORRECT);

      const backupCodes = JSON.stringify([HASH_CORRECT, HASH_WRONG]);
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ backupCodes }));
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);

      await service.verifyBackupCode('user-uuid', 'AAAAA-BBBBB', false, makeCtx());

      const updateArg = tfRepo.update.mock.calls[0][1] as { backupCodes: string };
      const remaining: string[] = JSON.parse(updateArg.backupCodes) as string[];
      expect(remaining).toEqual([HASH_WRONG]);
    });

    it('throws UnauthorizedException when no backup codes exist', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ backupCodes: null }));

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(
        service.verifyBackupCode('user-uuid', 'AAAAA-BBBBB', false, makeCtx()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no TwoFactor record is found', async () => {
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(
        service.verifyBackupCode('user-uuid', 'AAAAA-BBBBB', false, makeCtx()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the code does not match any stored hash', async () => {
      // The service hashes the incoming code; returning HASH_WRONG won't match HASH_CORRECT in storage
      mockHashToken.mockReturnValue(HASH_WRONG);

      const backupCodes = JSON.stringify([HASH_CORRECT]);
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ backupCodes }));

      dataSource.getRepository.mockReturnValue(tfRepo);

      await expect(
        service.verifyBackupCode('user-uuid', 'WRONG-CODES', false, makeCtx()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('creates trust cookie when trustDevice=true', async () => {
      mockHashToken.mockReturnValue(HASH_CORRECT);

      const backupCodes = JSON.stringify([HASH_CORRECT]);
      const tfRepo = mockRepository();
      tfRepo.findOne.mockResolvedValue(makeTwoFactor({ backupCodes }));
      tfRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(tfRepo);

      const result = await service.verifyBackupCode('user-uuid', 'AAAAA-BBBBB', true, makeCtx());

      expect(result.trustCookieValue).toBe('trust-cookie');
      expect(twoFactorGate.createTrustDeviceCookieValue).toHaveBeenCalledWith('user-uuid');
    });
  });
});
