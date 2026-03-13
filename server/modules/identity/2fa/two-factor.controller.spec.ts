import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorGateService } from '../auth/services/two-factor-gate.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { JwtFreshGuard } from '../auth/guards/jwt-fresh.guard';
import { TwoFactorPendingGuard } from './guards/two-factor-pending.guard';
import {
  TFA_PENDING_COOKIE,
  TRUST_DEVICE_COOKIE,
} from '../auth/auth.constants';
import { UserRole } from '../user/user-role.enum';
import type { Request as ExpressRequest, Response } from 'express';

// Prevent transitive ESM imports (otplib / @scure/base) from being evaluated
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  NobleCryptoPlugin: jest.fn(),
  ScureBase32Plugin: jest.fn(),
  TOTP: jest.fn(),
}));
jest.mock('./two-factor.service');
import { TwoFactorService } from './two-factor.service';

const noopGuard: CanActivate = { canActivate: () => true };

const makeRequest = (
  userId = 'user-uuid',
  role = UserRole.Member,
): ExpressRequest & { user: { userId: string; role: UserRole } } =>
  ({
    user: { userId, role },
    cookies: {},
    headers: {},
  }) as unknown as ExpressRequest & { user: { userId: string; role: UserRole } };

const makeMockResponse = (): jest.Mocked<Response> =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }) as unknown as jest.Mocked<Response>;

const makeTokens = () => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(),
});

const mockTwoFactorService = () => ({
  enable: jest.fn(),
  verifyEnableTotp: jest.fn(),
  disable: jest.fn(),
  getTotpUri: jest.fn(),
  verifyTotp: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  verifyBackupCode: jest.fn(),
  generateBackupCodes: jest.fn(),
});

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
  createTrustDeviceCookieValue: jest.fn(),
});

describe('TwoFactorController', () => {
  let controller: TwoFactorController;
  let twoFactorService: ReturnType<typeof mockTwoFactorService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  beforeEach(async () => {
    twoFactorService = mockTwoFactorService();
    twoFactorGate = mockTwoFactorGateService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TwoFactorController],
      providers: [
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .overrideGuard(JwtAccessGuard)
      .useValue(noopGuard)
      .overrideGuard(JwtFreshGuard)
      .useValue(noopGuard)
      .overrideGuard(TwoFactorPendingGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(TwoFactorController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── enable ─────────────────────────────────────────────────────────────────

  describe('enable', () => {
    it('delegates to twoFactorService.enable and returns the result', async () => {
      const result = { totpURI: 'otpauth://totp/...', backupCodes: ['code1'] };
      twoFactorService.enable.mockResolvedValue(result);

      const req = makeRequest();
      const dto = { password: 'secret' };

      const response = await controller.enable(req, dto as never);

      expect(twoFactorService.enable).toHaveBeenCalledWith('user-uuid', dto);
      expect(response).toBe(result);
    });
  });

  // ─── verifyEnable ────────────────────────────────────────────────────────────

  describe('verifyEnable', () => {
    it('delegates to twoFactorService.verifyEnableTotp and returns { ok: true }', async () => {
      twoFactorService.verifyEnableTotp.mockResolvedValue(undefined);

      const req = makeRequest();
      const result = await controller.verifyEnable(req, { code: '123456' });

      expect(twoFactorService.verifyEnableTotp).toHaveBeenCalledWith('user-uuid', '123456');
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── disable ─────────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('delegates to twoFactorService.disable, clears TRUST_DEVICE_COOKIE, and returns { ok: true }', async () => {
      twoFactorService.disable.mockResolvedValue(undefined);
      const req = makeRequest();
      const res = makeMockResponse();

      const result = await controller.disable(req, { password: 'secret' }, res);

      expect(twoFactorService.disable).toHaveBeenCalledWith('user-uuid', 'secret');
      expect(res.clearCookie).toHaveBeenCalledWith(TRUST_DEVICE_COOKIE);
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── getTotpUri ───────────────────────────────────────────────────────────────

  describe('getTotpUri', () => {
    it('delegates to twoFactorService.getTotpUri and returns { totpURI }', async () => {
      twoFactorService.getTotpUri.mockResolvedValue('otpauth://totp/...');

      const req = makeRequest();
      const result = await controller.getTotpUri(req, { password: 'secret' });

      expect(twoFactorService.getTotpUri).toHaveBeenCalledWith('user-uuid', 'secret');
      expect(result).toEqual({ totpURI: 'otpauth://totp/...' });
    });
  });

  // ─── verifyTotp ───────────────────────────────────────────────────────────────

  describe('verifyTotp', () => {
    it('clears TFA_PENDING_COOKIE, sets token cookies, and returns { ok, accessToken, refreshToken }', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyTotp.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      const result = await controller.verifyTotp(
        req,
        { code: '123456', trustDevice: false },
        undefined,
        undefined,
        res,
      );

      expect(res.clearCookie).toHaveBeenCalledWith(TFA_PENDING_COOKIE);
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });

    it('sets trust device cookie when trustCookieValue is returned', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyTotp.mockResolvedValue({
        tokens,
        trustCookieValue: 'trust-value',
      });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyTotp(
        req,
        { code: '123456', trustDevice: true },
        undefined,
        undefined,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'trust-value',
        expect.any(Object),
      );
    });

    it('does not set trust device cookie when trustCookieValue is null', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyTotp.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyTotp(
        req,
        { code: '123456', trustDevice: false },
        undefined,
        undefined,
        res,
      );

      const cookieCalls = (res.cookie as jest.Mock).mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(cookieCalls).not.toContain(TRUST_DEVICE_COOKIE);
    });

    it('delegates with correct ip and userAgent from headers', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyTotp.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyTotp(
        req,
        { code: '123456', trustDevice: false },
        '10.0.0.1, 192.168.1.1',
        'jest-agent',
        res,
      );

      expect(twoFactorService.verifyTotp).toHaveBeenCalledWith(
        'user-uuid',
        UserRole.Member,
        '123456',
        false,
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
      );
    });
  });

  // ─── sendOtp ──────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('delegates to twoFactorService.sendOtp and returns { ok: true }', async () => {
      twoFactorService.sendOtp.mockResolvedValue(undefined);
      const req = makeRequest();

      const result = await controller.sendOtp(req);

      expect(twoFactorService.sendOtp).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── verifyOtp ────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('clears TFA_PENDING_COOKIE, sets token cookies, and returns { ok, accessToken, refreshToken }', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyOtp.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      const result = await controller.verifyOtp(
        req,
        { code: '654321', trustDevice: false },
        undefined,
        undefined,
        res,
      );

      expect(res.clearCookie).toHaveBeenCalledWith(TFA_PENDING_COOKIE);
      expect(result).toEqual({
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });

    it('sets trust device cookie when trustCookieValue is returned', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyOtp.mockResolvedValue({
        tokens,
        trustCookieValue: 'trust-value',
      });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyOtp(
        req,
        { code: '654321', trustDevice: true },
        undefined,
        undefined,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'trust-value',
        expect.any(Object),
      );
    });

    it('does not set trust device cookie when trustCookieValue is null', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyOtp.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyOtp(
        req,
        { code: '654321', trustDevice: false },
        undefined,
        undefined,
        res,
      );

      const cookieCalls = (res.cookie as jest.Mock).mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(cookieCalls).not.toContain(TRUST_DEVICE_COOKIE);
    });
  });

  // ─── verifyBackupCode ─────────────────────────────────────────────────────────

  describe('verifyBackupCode', () => {
    it('clears TFA_PENDING_COOKIE, sets token cookies, and returns { ok, accessToken, refreshToken }', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyBackupCode.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      const result = await controller.verifyBackupCode(
        req,
        { code: 'backup-code', trustDevice: false },
        undefined,
        undefined,
        res,
      );

      expect(res.clearCookie).toHaveBeenCalledWith(TFA_PENDING_COOKIE);
      expect(result).toEqual({
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });

    it('sets trust device cookie when trustCookieValue is returned', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyBackupCode.mockResolvedValue({
        tokens,
        trustCookieValue: 'trust-value',
      });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyBackupCode(
        req,
        { code: 'backup-code', trustDevice: true },
        undefined,
        undefined,
        res,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'trust-value',
        expect.any(Object),
      );
    });

    it('does not set trust device cookie when trustCookieValue is null', async () => {
      const tokens = makeTokens();
      twoFactorService.verifyBackupCode.mockResolvedValue({ tokens, trustCookieValue: null });
      const req = makeRequest();
      const res = makeMockResponse();

      await controller.verifyBackupCode(
        req,
        { code: 'backup-code', trustDevice: false },
        undefined,
        undefined,
        res,
      );

      const cookieCalls = (res.cookie as jest.Mock).mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(cookieCalls).not.toContain(TRUST_DEVICE_COOKIE);
    });
  });

  // ─── generateBackupCodes ──────────────────────────────────────────────────────

  describe('generateBackupCodes', () => {
    it('delegates to twoFactorService.generateBackupCodes and returns { backupCodes }', async () => {
      const backupCodes = ['code1', 'code2', 'code3'];
      twoFactorService.generateBackupCodes.mockResolvedValue(backupCodes);
      const req = makeRequest();

      const result = await controller.generateBackupCodes(req, { password: 'secret' });

      expect(twoFactorService.generateBackupCodes).toHaveBeenCalledWith(
        'user-uuid',
        'secret',
      );
      expect(result).toEqual({ backupCodes });
    });
  });
});
