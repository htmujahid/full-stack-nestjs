import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth.constants';
import { UserRole } from '../../user/user-role.enum';
import type { Request as ExpressRequest, Response } from 'express';

const noopGuard: CanActivate = { canActivate: () => true };

interface RefreshUser {
  userId: string;
  role: UserRole;
  sessionId: string;
  familyId: string;
  rawRefreshToken: string;
}

const makeRefreshUser = (overrides: Partial<RefreshUser> = {}): RefreshUser => ({
  userId: 'user-uuid',
  role: UserRole.Member,
  sessionId: 'session-uuid',
  familyId: 'family-uuid',
  rawRefreshToken: 'raw-refresh-token',
  ...overrides,
});

const makeTokens = () => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(),
});

const mockAuthService = () => ({
  refreshTokens: jest.fn(),
  signOut: jest.fn(),
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
  user: RefreshUser,
  overrides: Partial<ExpressRequest> = {},
): ExpressRequest & { user: RefreshUser } =>
  ({
    user,
    cookies: {},
    ...overrides,
  }) as unknown as ExpressRequest & { user: RefreshUser };

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  beforeEach(async () => {
    authService = mockAuthService();
    twoFactorGate = mockTwoFactorGateService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(noopGuard)
      .overrideGuard(JwtRefreshGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── refresh ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('calls authService.refreshTokens with correct args from request user', async () => {
      const user = makeRefreshUser();
      const tokens = makeTokens();
      authService.refreshTokens.mockResolvedValue(tokens);

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      await controller.refresh(req, undefined, undefined, res);

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        user.userId,
        user.role,
        user.sessionId,
        user.familyId,
        user.rawRefreshToken,
        { ip: null, userAgent: null },
      );
    });

    it('extracts the first IP from x-forwarded-for and passes userAgent', async () => {
      const user = makeRefreshUser();
      const tokens = makeTokens();
      authService.refreshTokens.mockResolvedValue(tokens);

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      await controller.refresh(req, '10.0.0.1, 172.16.0.1', 'jest-agent', res);

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        user.userId,
        user.role,
        user.sessionId,
        user.familyId,
        user.rawRefreshToken,
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
      );
    });

    it('calls res.cookie twice (setTokenCookies) and returns ok + tokens', async () => {
      const user = makeRefreshUser();
      const tokens = makeTokens();
      authService.refreshTokens.mockResolvedValue(tokens);

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      const result = await controller.refresh(req, undefined, undefined, res);

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });

    it('propagates UnauthorizedException when authService.refreshTokens throws', async () => {
      const user = makeRefreshUser();
      authService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Refresh token reuse detected'),
      );

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      await expect(
        controller.refresh(req, undefined, undefined, res),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── signOut ────────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('calls authService.signOut with userId and sessionId from request', async () => {
      const user = makeRefreshUser();
      authService.signOut.mockResolvedValue(undefined);

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      await controller.signOut(req, res);

      expect(authService.signOut).toHaveBeenCalledWith(user.userId, user.sessionId);
    });

    it('clears ACCESS_TOKEN_COOKIE and REFRESH_TOKEN_COOKIE', async () => {
      const user = makeRefreshUser();
      authService.signOut.mockResolvedValue(undefined);

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      await controller.signOut(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({ path: '/api/auth' }),
      );
    });

    it('returns { ok: true }', async () => {
      const user = makeRefreshUser();
      authService.signOut.mockResolvedValue(undefined);

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      const result = await controller.signOut(req, res);

      expect(result).toEqual({ ok: true });
    });

    it('propagates error when authService.signOut throws', async () => {
      const user = makeRefreshUser();
      authService.signOut.mockRejectedValue(new Error('DB failure'));

      const req = makeMockRequest(user);
      const res = makeMockResponse();

      await expect(controller.signOut(req, res)).rejects.toThrow('DB failure');
    });
  });
});
