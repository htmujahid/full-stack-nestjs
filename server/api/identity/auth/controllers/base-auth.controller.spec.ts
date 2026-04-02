import type { Request, Response } from 'express';
import { BaseAuthController } from './base-auth.controller';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { UserRole } from '../../user/user-role.enum';
import {
  ACCESS_EXPIRES_MS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
  REFRESH_TOKEN_COOKIE,
  TFA_PENDING_COOKIE,
  TFA_PENDING_EXPIRES_MS,
  TRUST_DEVICE_COOKIE,
  TRUST_DEVICE_EXPIRES_MS,
} from '../auth.constants';

// ─── Concrete subclass exposing protected methods for testing ─────────────────
// Instantiated directly (not via TestingModule) so that the constructor
// injection works without NestJS decorator metadata on this test-only subclass.

class TestController extends BaseAuthController {
  constructor(twoFactorGate: TwoFactorGateService) {
    super(twoFactorGate);
  }

  testCheckTwoFactor = (
    user: { id: string; role: UserRole; twoFactorEnabled: boolean },
    req: Request,
    res: Response,
  ) => this.checkTwoFactor(user as unknown as import('../../user/user.entity').User, req, res);

  testSetTokenCookies = (
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
    rememberMe: boolean,
    sameSite?: 'strict' | 'lax',
  ) => this.setTokenCookies(res, tokens as any, rememberMe, sameSite);

  testSetPendingCookie = (res: Response, token: string) =>
    this.setPendingCookie(res, token);

  testSetTrustDeviceCookie = (res: Response, value: string) =>
    this.setTrustDeviceCookie(res, value);
}

// ─── Factories ────────────────────────────────────────────────────────────────

const makeUser = (
  overrides: Partial<{
    id: string;
    role: UserRole;
    twoFactorEnabled: boolean;
  }> = {},
) => ({
  id: 'user-uuid',
  role: UserRole.Member,
  twoFactorEnabled: false,
  ...overrides,
});

const makeTokens = () => ({
  accessToken: 'access-jwt',
  refreshToken: 'refresh-jwt',
  refreshExpiresAt: new Date(),
});

const makeMockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }) as unknown as Response;

const makeMockRequest = (cookies: Record<string, string> = {}): Request =>
  ({ cookies }) as unknown as Request;

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BaseAuthController', () => {
  let controller: TestController;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  beforeEach(() => {
    twoFactorGate = mockTwoFactorGateService();
    controller = new TestController(
      twoFactorGate as unknown as TwoFactorGateService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  // ─── checkTwoFactor ──────────────────────────────────────────────────────────

  describe('checkTwoFactor', () => {
    it('returns "pass" immediately when twoFactorEnabled is false without calling twoFactorGate', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const req = makeMockRequest();
      const res = makeMockResponse();

      const result = await controller.testCheckTwoFactor(user, req, res);

      expect(result).toBe('pass');
      expect(twoFactorGate.checkTrustDevice).not.toHaveBeenCalled();
      expect(twoFactorGate.createPendingToken).not.toHaveBeenCalled();
      expect(twoFactorGate.rotateTrustDevice).not.toHaveBeenCalled();
    });

    it('returns "pending" and sets pending cookie when no trust_device cookie is present', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const req = makeMockRequest({}); // no TRUST_DEVICE_COOKIE
      const res = makeMockResponse();

      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const result = await controller.testCheckTwoFactor(user, req, res);

      expect(result).toBe('pending');
      expect(twoFactorGate.checkTrustDevice).not.toHaveBeenCalled();
      expect(twoFactorGate.createPendingToken).toHaveBeenCalledWith(
        user.id,
        user.role,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        TFA_PENDING_COOKIE,
        'pending-jwt',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('returns "pending" and creates pending token when trust_device cookie is present but not trusted', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const req = makeMockRequest({ [TRUST_DEVICE_COOKIE]: 'old-trust-value' });
      const res = makeMockResponse();

      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const result = await controller.testCheckTwoFactor(user, req, res);

      expect(result).toBe('pending');
      expect(twoFactorGate.checkTrustDevice).toHaveBeenCalledWith(
        'old-trust-value',
        user.id,
      );
      expect(twoFactorGate.createPendingToken).toHaveBeenCalledWith(
        user.id,
        user.role,
      );
    });

    it('returns "pass" and rotates trust device when device is trusted', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const req = makeMockRequest({ [TRUST_DEVICE_COOKIE]: 'trust-token' });
      const res = makeMockResponse();

      twoFactorGate.checkTrustDevice.mockResolvedValue(true);
      twoFactorGate.rotateTrustDevice.mockResolvedValue('new-trust-token');

      const result = await controller.testCheckTwoFactor(user, req, res);

      expect(result).toBe('pass');
      expect(twoFactorGate.rotateTrustDevice).toHaveBeenCalledWith(
        'trust-token',
        user.id,
      );
      expect(twoFactorGate.createPendingToken).not.toHaveBeenCalled();
    });

    it('sets the new trust cookie after rotating', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const req = makeMockRequest({ [TRUST_DEVICE_COOKIE]: 'trust-token' });
      const res = makeMockResponse();

      twoFactorGate.checkTrustDevice.mockResolvedValue(true);
      twoFactorGate.rotateTrustDevice.mockResolvedValue('rotated-trust-token');

      await controller.testCheckTwoFactor(user, req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'rotated-trust-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  // ─── setTokenCookies ─────────────────────────────────────────────────────────

  describe('setTokenCookies', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, NODE_ENV: 'test' };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('sets access_token cookie with httpOnly, sameSite strict, path "/", and ACCESS_EXPIRES_MS', () => {
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false);

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: ACCESS_EXPIRES_MS,
        }),
      );
    });

    it('sets refresh_token cookie with REFRESH_REMEMBER_ME_EXPIRES_MS when rememberMe is true', () => {
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, true);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        tokens.refreshToken,
        expect.objectContaining({ maxAge: REFRESH_REMEMBER_ME_EXPIRES_MS }),
      );
    });

    it('sets refresh_token cookie with REFRESH_EXPIRES_MS when rememberMe is false', () => {
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        tokens.refreshToken,
        expect.objectContaining({ maxAge: REFRESH_EXPIRES_MS }),
      );
    });

    it('sets refresh_token cookie path to "/api/auth"', () => {
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        tokens.refreshToken,
        expect.objectContaining({ path: '/api/auth' }),
      );
    });

    it('sets secure=false when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'test';
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false);

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({ secure: false }),
      );
    });

    it('sets secure=true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false);

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({ secure: true }),
      );
    });

    it('defaults sameSite to "strict" when not provided', () => {
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false);

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({ sameSite: 'strict' }),
      );
    });

    it('uses the provided sameSite value when explicitly passed', () => {
      const tokens = makeTokens();
      const res = makeMockResponse();

      controller.testSetTokenCookies(res, tokens, false, 'lax');

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({ sameSite: 'lax' }),
      );
    });
  });

  // ─── setPendingCookie ────────────────────────────────────────────────────────

  describe('setPendingCookie', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, NODE_ENV: 'test' };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('sets TFA_PENDING_COOKIE with httpOnly, sameSite strict, path "/api/two-factor", and TFA_PENDING_EXPIRES_MS', () => {
      const res = makeMockResponse();

      controller.testSetPendingCookie(res, 'pending-token');

      expect(res.cookie).toHaveBeenCalledWith(
        TFA_PENDING_COOKIE,
        'pending-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/api/two-factor',
          maxAge: TFA_PENDING_EXPIRES_MS,
        }),
      );
    });

    it('sets secure=false when not in production', () => {
      process.env.NODE_ENV = 'development';
      const res = makeMockResponse();

      controller.testSetPendingCookie(res, 'pending-token');

      expect(res.cookie).toHaveBeenCalledWith(
        TFA_PENDING_COOKIE,
        'pending-token',
        expect.objectContaining({ secure: false }),
      );
    });

    it('sets secure=true when in production', () => {
      process.env.NODE_ENV = 'production';
      const res = makeMockResponse();

      controller.testSetPendingCookie(res, 'pending-token');

      expect(res.cookie).toHaveBeenCalledWith(
        TFA_PENDING_COOKIE,
        'pending-token',
        expect.objectContaining({ secure: true }),
      );
    });
  });

  // ─── setTrustDeviceCookie ────────────────────────────────────────────────────

  describe('setTrustDeviceCookie', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, NODE_ENV: 'test' };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('sets TRUST_DEVICE_COOKIE with httpOnly, sameSite strict, path "/", and TRUST_DEVICE_EXPIRES_MS', () => {
      const res = makeMockResponse();

      controller.testSetTrustDeviceCookie(res, 'trust-value');

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'trust-value',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: TRUST_DEVICE_EXPIRES_MS,
        }),
      );
    });

    it('sets secure=false when not in production', () => {
      process.env.NODE_ENV = 'development';
      const res = makeMockResponse();

      controller.testSetTrustDeviceCookie(res, 'trust-value');

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'trust-value',
        expect.objectContaining({ secure: false }),
      );
    });

    it('sets secure=true when in production', () => {
      process.env.NODE_ENV = 'production';
      const res = makeMockResponse();

      controller.testSetTrustDeviceCookie(res, 'trust-value');

      expect(res.cookie).toHaveBeenCalledWith(
        TRUST_DEVICE_COOKIE,
        'trust-value',
        expect.objectContaining({ secure: true }),
      );
    });
  });
});
