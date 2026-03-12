import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ConflictException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PhoneController } from './phone.controller';
import { PhoneService } from '../services/phone.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { JwtFreshGuard } from '../guards/jwt-fresh.guard';
import { User } from '../../user/user.entity';
import type { Request as ExpressRequest, Response } from 'express';

const noopGuard: CanActivate = { canActivate: () => true };

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: '+15550001234',
    phoneVerified: true,
    emailVerified: false,
    twoFactorEnabled: false,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const makeTokens = () => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(),
});

const mockPhoneService = () => ({
  sendSignInOtp: jest.fn(),
  verifySignInOtp: jest.fn(),
  sendVerificationOtp: jest.fn(),
  verifyPhone: jest.fn(),
  initiatePhoneChange: jest.fn(),
  verifyPhoneChange: jest.fn(),
});

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
  createTrustDeviceCookieValue: jest.fn(),
});

const makeMockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  }) as unknown as Response;

const makeMockRequest = (
  overrides: Partial<ExpressRequest & { user: { userId: string } }> = {},
): ExpressRequest & { user: { userId: string } } =>
  ({
    user: { userId: 'user-uuid' },
    cookies: {},
    ...overrides,
  }) as unknown as ExpressRequest & { user: { userId: string } };

describe('PhoneController', () => {
  let controller: PhoneController;
  let phoneService: ReturnType<typeof mockPhoneService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  beforeEach(async () => {
    phoneService = mockPhoneService();
    twoFactorGate = mockTwoFactorGateService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhoneController],
      providers: [
        { provide: PhoneService, useValue: phoneService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .overrideGuard(JwtFreshGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(PhoneController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── sendSignInOtp ───────────────────────────────────────────────────────────

  describe('sendSignInOtp', () => {
    it('delegates to phoneService.sendSignInOtp and returns { ok: true }', async () => {
      phoneService.sendSignInOtp.mockResolvedValue(undefined);

      const result = await controller.sendSignInOtp({ phone: '+15550001234' });

      expect(phoneService.sendSignInOtp).toHaveBeenCalledWith('+15550001234');
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── verifySignInOtp ─────────────────────────────────────────────────────────

  describe('verifySignInOtp', () => {
    it('extracts the first IP from x-forwarded-for header', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      phoneService.verifySignInOtp.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      await controller.verifySignInOtp(
        { phone: '+15550001234', code: '123456' },
        '10.0.0.1, 172.16.0.1',
        'jest-agent',
        res,
        req,
      );

      expect(phoneService.verifySignInOtp).toHaveBeenCalledWith(
        '+15550001234',
        '123456',
        true,
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
      );
    });

    it('defaults rememberMe to true when dto.rememberMe is undefined', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      phoneService.verifySignInOtp.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      await controller.verifySignInOtp(
        { phone: '+15550001234', code: '123456' },
        undefined,
        undefined,
        res,
        req,
      );

      expect(phoneService.verifySignInOtp).toHaveBeenCalledWith(
        '+15550001234',
        '123456',
        true,
        expect.any(Object),
      );
    });

    it('returns { twoFactorRedirect: true } when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const tokens = makeTokens();
      phoneService.verifySignInOtp.mockResolvedValue({ user, tokens });
      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      const result = await controller.verifySignInOtp(
        { phone: '+15550001234', code: '123456' },
        undefined,
        undefined,
        res,
        req,
      );

      expect(result).toEqual({ twoFactorRedirect: true });
      expect(res.cookie).toHaveBeenCalledTimes(1); // pending cookie only
    });

    it('sets token cookies and returns tokens on success', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      phoneService.verifySignInOtp.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      const result = await controller.verifySignInOtp(
        { phone: '+15550001234', code: '123456', callbackURL: '/home' },
        undefined,
        undefined,
        res,
        req,
      );

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        url: '/home',
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });

    it('uses null url when callbackURL is not provided', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      phoneService.verifySignInOtp.mockResolvedValue({ user, tokens });

      const req = makeMockRequest({ cookies: {} });
      const res = makeMockResponse();

      const result = await controller.verifySignInOtp(
        { phone: '+15550001234', code: '123456' },
        undefined,
        undefined,
        res,
        req,
      );

      expect(result).toEqual(expect.objectContaining({ url: null }));
    });
  });

  // ─── sendVerificationOtp ─────────────────────────────────────────────────────

  describe('sendVerificationOtp', () => {
    it('delegates to phoneService.sendVerificationOtp and returns { ok: true }', async () => {
      phoneService.sendVerificationOtp.mockResolvedValue(undefined);

      const result = await controller.sendVerificationOtp({ phone: '+15550001234' });

      expect(phoneService.sendVerificationOtp).toHaveBeenCalledWith('+15550001234');
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── verifyPhone ─────────────────────────────────────────────────────────────

  describe('verifyPhone', () => {
    it('returns { ok: false, error } when service returns !ok', async () => {
      phoneService.verifyPhone.mockResolvedValue({
        ok: false,
        error: 'INVALID_CODE',
      });

      const result = await controller.verifyPhone({
        phone: '+15550001234',
        code: 'wrong',
      });

      expect(result).toEqual({ ok: false, error: 'INVALID_CODE' });
    });

    it('returns { ok: true } on success', async () => {
      phoneService.verifyPhone.mockResolvedValue({ ok: true });

      const result = await controller.verifyPhone({
        phone: '+15550001234',
        code: '123456',
      });

      expect(result).toEqual({ ok: true });
    });
  });

  // ─── updatePhone ─────────────────────────────────────────────────────────────

  describe('updatePhone', () => {
    it('delegates to phoneService.initiatePhoneChange with userId from request; returns { ok: true }', async () => {
      phoneService.initiatePhoneChange.mockResolvedValue(undefined);

      const req = makeMockRequest({ user: { userId: 'user-uuid' } });

      const result = await controller.updatePhone(req, {
        newPhone: '+15559998888',
      });

      expect(phoneService.initiatePhoneChange).toHaveBeenCalledWith(
        'user-uuid',
        '+15559998888',
      );
      expect(result).toEqual({ ok: true });
    });

    it('propagates ConflictException when service throws', async () => {
      phoneService.initiatePhoneChange.mockRejectedValue(
        new ConflictException('Phone already in use'),
      );

      const req = makeMockRequest({ user: { userId: 'user-uuid' } });

      await expect(
        controller.updatePhone(req, { newPhone: '+15559998888' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── verifyPhoneChange ───────────────────────────────────────────────────────

  describe('verifyPhoneChange', () => {
    it('returns { ok: false, error } when service returns !ok', async () => {
      phoneService.verifyPhoneChange.mockResolvedValue({
        ok: false,
        error: 'EXPIRED_CODE',
      });

      const result = await controller.verifyPhoneChange({
        phone: '+15550001234',
        code: 'wrong',
      });

      expect(result).toEqual({ ok: false, error: 'EXPIRED_CODE' });
    });

    it('returns { ok: true } on success', async () => {
      phoneService.verifyPhoneChange.mockResolvedValue({ ok: true });

      const result = await controller.verifyPhoneChange({
        phone: '+15550001234',
        code: '123456',
      });

      expect(result).toEqual({ ok: true });
    });
  });
});
