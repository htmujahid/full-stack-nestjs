import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PhoneService } from './phone.service';
import { AuthService } from './auth.service';
import { User } from '../../user/user.entity';
import { Verification } from '../entities/verification.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { mockDataSource, mockRepository } from '../../../../mocks/db.mock';
import {
  PHONE_CHANGE_IDENTIFIER_PREFIX,
  PHONE_OTP_EXPIRES_MS,
  PHONE_OTP_IDENTIFIER_PREFIX,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_VERIFY_IDENTIFIER_PREFIX,
} from '../auth.constants';
import type { TokenPair } from './auth.service';

const NOW = 2_000_000_000_000;

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Phone User',
    email: 'phone@example.com',
    username: null,
    phone: '+15555555555',
    phoneVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    image: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as User;

const makeVerification = (overrides: Partial<Verification> = {}): Verification =>
  ({
    id: 'ver-uuid',
    identifier: `${PHONE_OTP_IDENTIFIER_PREFIX}+15555555555`,
    value: JSON.stringify({ hash: '123456', attempts: 0 }),
    expiresAt: new Date(NOW + PHONE_OTP_EXPIRES_MS),
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as Verification;

const makeTokenPair = (): TokenPair => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(NOW + 604_800_000),
});

const ctx = { ip: '127.0.0.1', userAgent: 'jest' };

describe('PhoneService', () => {
  let service: PhoneService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let authService: { createAuthSession: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    authService = { createAuthSession: jest.fn().mockResolvedValue(makeTokenPair()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneService,
        { provide: DataSource, useValue: dataSource },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get(PhoneService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── sendSignInOtp ───────────────────────────────────────────────────────────

  describe('sendSignInOtp', () => {
    it('creates a verification record when user exists', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser());

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendSignInOtp('+15555555555');

      expect(verRepo.save).toHaveBeenCalledTimes(1);
    });

    it('returns without creating OTP record when user is not found', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const verRepo = mockRepository();

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendSignInOtp('+19999999999');

      expect(verRepo.save).not.toHaveBeenCalled();
    });

    it('trims the phone number before user lookup', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      await service.sendSignInOtp('  +15555555555  ');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { phone: '+15555555555' },
      });
    });

    it('deletes any existing OTP record before creating a new one', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser());

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendSignInOtp('+15555555555');

      expect(verRepo.delete).toHaveBeenCalledWith({
        identifier: `${PHONE_OTP_IDENTIFIER_PREFIX}+15555555555`,
      });
    });

    it('saves the OTP record with the correct expiry', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser());

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendSignInOtp('+15555555555');

      expect(verRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(NOW + PHONE_OTP_EXPIRES_MS),
        }),
      );
    });
  });

  // ─── verifySignInOtp ─────────────────────────────────────────────────────────

  describe('verifySignInOtp', () => {
    it('returns user and tokens on valid OTP', async () => {
      const user = makeUser();
      const verRecord = makeVerification({ value: JSON.stringify({ hash: '123456', attempts: 0 }) });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      const result = await service.verifySignInOtp('+15555555555', '123456', false, ctx);

      expect(result.user).toBe(user);
      expect(result.tokens).toEqual(makeTokenPair());
    });

    it('throws UnauthorizedException when user is not found', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      await expect(
        service.verifySignInOtp('+19999999999', '123456', false, ctx),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when OTP record is not found', async () => {
      const user = makeUser();
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await expect(
        service.verifySignInOtp('+15555555555', '000000', false, ctx),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when OTP record has expired', async () => {
      const user = makeUser();
      const verRecord = makeVerification({ expiresAt: new Date(NOW - 1) });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await expect(
        service.verifySignInOtp('+15555555555', '123456', false, ctx),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('marks phoneVerified=true when user is not yet verified', async () => {
      const user = makeUser({ phoneVerified: false });
      const verRecord = makeVerification({ value: JSON.stringify({ hash: '123456', attempts: 0 }) });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.verifySignInOtp('+15555555555', '123456', false, ctx);

      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', { phoneVerified: true });
    });

    it('skips phoneVerified update when user is already verified', async () => {
      const user = makeUser({ phoneVerified: true });
      const verRecord = makeVerification({ value: JSON.stringify({ hash: '123456', attempts: 0 }) });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.verifySignInOtp('+15555555555', '123456', false, ctx);

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('delegates to authService.createAuthSession with phone method', async () => {
      const user = makeUser({ phoneVerified: true });
      const verRecord = makeVerification({ value: JSON.stringify({ hash: '123456', attempts: 0 }) });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.verifySignInOtp('+15555555555', '123456', true, ctx);

      expect(authService.createAuthSession).toHaveBeenCalledWith(
        'user-uuid',
        true,
        ctx,
        'phone',
      );
    });
  });

  // ─── sendVerificationOtp ─────────────────────────────────────────────────────

  describe('sendVerificationOtp', () => {
    it('creates an OTP record when user exists and phone is not yet verified', async () => {
      const user = makeUser({ phoneVerified: false });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendVerificationOtp('+15555555555');

      expect(verRepo.save).toHaveBeenCalledTimes(1);
    });

    it('returns without creating OTP when user is not found', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const verRepo = mockRepository();
      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendVerificationOtp('+15555555555');

      expect(verRepo.save).not.toHaveBeenCalled();
    });

    it('returns without creating OTP when phone is already verified', async () => {
      const user = makeUser({ phoneVerified: true });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendVerificationOtp('+15555555555');

      expect(verRepo.save).not.toHaveBeenCalled();
    });

    it('uses PHONE_VERIFY_IDENTIFIER_PREFIX for the record identifier', async () => {
      const user = makeUser({ phoneVerified: false });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.sendVerificationOtp('+15555555555');

      expect(verRepo.delete).toHaveBeenCalledWith({
        identifier: `${PHONE_VERIFY_IDENTIFIER_PREFIX}+15555555555`,
      });
    });
  });

  // ─── verifyPhone ─────────────────────────────────────────────────────────────

  describe('verifyPhone', () => {
    it('returns ok=true and updates phoneVerified on valid code', async () => {
      const user = makeUser({ phoneVerified: false });
      const verRecord = makeVerification({
        identifier: `${PHONE_VERIFY_IDENTIFIER_PREFIX}+15555555555`,
        value: JSON.stringify({ hash: '654321', attempts: 0 }),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      const result = await service.verifyPhone('+15555555555', '654321');

      expect(result).toEqual({ ok: true });
      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', { phoneVerified: true });
    });

    it('returns ok=false with error=user_not_found when user does not exist', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(userRepo);

      const result = await service.verifyPhone('+19999999999', '123456');

      expect(result).toEqual({ ok: false, error: 'user_not_found' });
    });

    it('returns ok=true immediately when phone is already verified', async () => {
      const user = makeUser({ phoneVerified: true });
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);
      dataSource.getRepository.mockReturnValue(userRepo);

      const result = await service.verifyPhone('+15555555555', 'any-code');

      expect(result).toEqual({ ok: true });
    });

    it('returns ok=false with error=invalid_code when OTP is wrong', async () => {
      const user = makeUser({ phoneVerified: false });
      const verRecord = makeVerification({
        identifier: `${PHONE_VERIFY_IDENTIFIER_PREFIX}+15555555555`,
        value: JSON.stringify({ hash: '654321', attempts: 0 }),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      const result = await service.verifyPhone('+15555555555', 'wrong-code');

      expect(result).toEqual({ ok: false, error: 'invalid_code' });
    });

    it('returns ok=false with error=invalid_code when OTP has expired', async () => {
      const user = makeUser({ phoneVerified: false });
      const verRecord = makeVerification({
        identifier: `${PHONE_VERIFY_IDENTIFIER_PREFIX}+15555555555`,
        value: JSON.stringify({ hash: '654321', attempts: 0 }),
        expiresAt: new Date(NOW - 1),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      const result = await service.verifyPhone('+15555555555', '654321');

      expect(result).toEqual({ ok: false, error: 'invalid_code' });
    });
  });

  // ─── initiatePhoneChange ─────────────────────────────────────────────────────

  describe('initiatePhoneChange', () => {
    it('creates an OTP record for the new phone number', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.initiatePhoneChange('user-uuid', '+16666666666');

      expect(verRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when new phone number is already in use', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(makeUser({ phone: '+16666666666' }));
      dataSource.getRepository.mockReturnValue(userRepo);

      await expect(
        service.initiatePhoneChange('user-uuid', '+16666666666'),
      ).rejects.toThrow(ConflictException);
    });

    it('uses PHONE_CHANGE_IDENTIFIER_PREFIX for the record identifier', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.initiatePhoneChange('user-uuid', '+16666666666');

      expect(verRepo.delete).toHaveBeenCalledWith({
        identifier: `${PHONE_CHANGE_IDENTIFIER_PREFIX}+16666666666`,
      });
    });

    it('embeds userId in the OTP record value', async () => {
      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(null);

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.initiatePhoneChange('user-uuid', '+16666666666');

      const createArg = verRepo.create.mock.calls[0][0] as { value: string };
      const parsed = JSON.parse(createArg.value) as { userId: string };
      expect(parsed.userId).toBe('user-uuid');
    });
  });

  // ─── verifyPhoneChange ───────────────────────────────────────────────────────

  describe('verifyPhoneChange', () => {
    it('returns ok=true and updates phone and deletes sessions on valid code', async () => {
      const verRecord = makeVerification({
        identifier: `${PHONE_CHANGE_IDENTIFIER_PREFIX}+16666666666`,
        value: JSON.stringify({ hash: '777777', attempts: 0, userId: 'user-uuid' }),
      });

      const outerVerRepo = mockRepository();
      outerVerRepo.findOne
        .mockResolvedValueOnce(verRecord) // verifyPhoneChange reads the record
        .mockResolvedValueOnce(verRecord); // consumeOtp reads the record
      outerVerRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const txUserRepo = mockRepository();
      txUserRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      const txSessionRepo = mockRepository();
      txSessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(outerVerRepo);
      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === User) return txUserRepo;
            if (entity === RefreshSession) return txSessionRepo;
          }),
        };
        return cb(tx);
      });

      const result = await service.verifyPhoneChange('+16666666666', '777777');

      expect(result).toEqual({ ok: true });
      expect(txUserRepo.update).toHaveBeenCalledWith(
        'user-uuid',
        { phone: '+16666666666', phoneVerified: true },
      );
      expect(txSessionRepo.delete).toHaveBeenCalledWith({ userId: 'user-uuid' });
    });

    it('returns ok=false with error=code_not_found when no verification record exists', async () => {
      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.verifyPhoneChange('+16666666666', '777777');

      expect(result).toEqual({ ok: false, error: 'code_not_found' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('returns ok=false with error=invalid_record when userId is missing from record', async () => {
      const verRecord = makeVerification({
        identifier: `${PHONE_CHANGE_IDENTIFIER_PREFIX}+16666666666`,
        value: JSON.stringify({ hash: '777777', attempts: 0 }), // no userId
      });

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.verifyPhoneChange('+16666666666', '777777');

      expect(result).toEqual({ ok: false, error: 'invalid_record' });
    });

    it('returns ok=false with error=invalid_code when OTP code is wrong', async () => {
      const verRecord = makeVerification({
        identifier: `${PHONE_CHANGE_IDENTIFIER_PREFIX}+16666666666`,
        value: JSON.stringify({ hash: '777777', attempts: 0, userId: 'user-uuid' }),
      });

      const verRepo = mockRepository();
      verRepo.findOne
        .mockResolvedValueOnce(verRecord) // verifyPhoneChange
        .mockResolvedValueOnce(verRecord); // consumeOtp
      verRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.verifyPhoneChange('+16666666666', 'wrong-code');

      expect(result).toEqual({ ok: false, error: 'invalid_code' });
    });

    it('returns ok=false with error=invalid_code when OTP has expired', async () => {
      const expiredRecord = makeVerification({
        identifier: `${PHONE_CHANGE_IDENTIFIER_PREFIX}+16666666666`,
        value: JSON.stringify({ hash: '777777', attempts: 0, userId: 'user-uuid' }),
        expiresAt: new Date(NOW - 1),
      });

      const verRepo = mockRepository();
      verRepo.findOne
        .mockResolvedValueOnce(expiredRecord) // verifyPhoneChange
        .mockResolvedValueOnce(expiredRecord); // consumeOtp
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.verifyPhoneChange('+16666666666', '777777');

      expect(result).toEqual({ ok: false, error: 'invalid_code' });
    });
  });

  // ─── consumeOtp (tested indirectly via verifySignInOtp) ─────────────────────

  describe('consumeOtp — via verifySignInOtp', () => {
    it('throws BadRequestException when attempt count reaches PHONE_OTP_MAX_ATTEMPTS', async () => {
      const user = makeUser({ phoneVerified: true });
      const verRecord = makeVerification({
        value: JSON.stringify({ hash: '123456', attempts: PHONE_OTP_MAX_ATTEMPTS }),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await expect(
        service.verifySignInOtp('+15555555555', 'wrong-code', false, ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('increments attempt count and throws UnauthorizedException on wrong code', async () => {
      const user = makeUser({ phoneVerified: true });
      const verRecord = makeVerification({
        value: JSON.stringify({ hash: '123456', attempts: 1 }),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await expect(
        service.verifySignInOtp('+15555555555', 'wrong-code', false, ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(verRepo.update).toHaveBeenCalledWith(
        verRecord.id,
        expect.objectContaining({
          value: JSON.stringify({ hash: '123456', attempts: 2 }),
        }),
      );
    });

    it('deletes OTP record after successful consumption', async () => {
      const user = makeUser({ phoneVerified: true });
      const verRecord = makeVerification({
        value: JSON.stringify({ hash: '123456', attempts: 0 }),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await service.verifySignInOtp('+15555555555', '123456', false, ctx);

      expect(verRepo.delete).toHaveBeenCalledWith(verRecord.id);
    });

    it('deletes expired OTP record and throws UnauthorizedException', async () => {
      const user = makeUser({ phoneVerified: true });
      const verRecord = makeVerification({
        value: JSON.stringify({ hash: '123456', attempts: 0 }),
        expiresAt: new Date(NOW - 1),
      });

      const userRepo = mockRepository();
      userRepo.findOne.mockResolvedValue(user);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(verRecord);
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.getRepository.mockImplementation((entity) => {
        if (entity === User) return userRepo;
        return verRepo;
      });

      await expect(
        service.verifySignInOtp('+15555555555', '123456', false, ctx),
      ).rejects.toThrow(UnauthorizedException);

      expect(verRepo.delete).toHaveBeenCalledWith(verRecord.id);
    });
  });
});
