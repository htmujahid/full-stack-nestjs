import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GoogleController } from './google.controller';
import { GoogleService } from '../services/google.service';
import { AccountService } from '../../account/account.service';
import { TwoFactorGateService } from '../../auth/services/two-factor-gate.service';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import {
  ACCESS_TOKEN_COOKIE,
  LINK_INTENT_COOKIE,
  OAUTH_REDIRECT_COOKIE,
} from '../../auth/auth.constants';
import type { GoogleProfile } from '../strategies/google.strategy';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import type { Request as ExpressRequest, Response } from 'express';

const noopGuard: CanActivate = { canActivate: () => true };

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const makeGoogleProfile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
  providerId: 'google',
  accountId: 'google-account-id',
  email: 'test@example.com',
  name: 'Test User',
  image: null,
  accessToken: 'google-access-token',
  refreshToken: null,
  ...overrides,
});

const makeTokens = () => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date(),
});

const mockGoogleService = () => ({
  findOrCreateUser: jest.fn(),
  createSession: jest.fn(),
});

const mockAccountService = () => ({
  listAccounts: jest.fn(),
  linkAccount: jest.fn(),
  unlinkAccount: jest.fn(),
});

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
  createTrustDeviceCookieValue: jest.fn(),
});

const mockJwtService = () => ({
  verify: jest.fn(),
});

const makeMockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  }) as unknown as Response;

const makeMockRequest = (
  profile: GoogleProfile,
  cookies: Record<string, string> = {},
): ExpressRequest & { user: GoogleProfile } =>
  ({
    user: profile,
    cookies,
  }) as unknown as ExpressRequest & { user: GoogleProfile };

describe('GoogleController', () => {
  let controller: GoogleController;
  let googleService: ReturnType<typeof mockGoogleService>;
  let accountService: ReturnType<typeof mockAccountService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(async () => {
    googleService = mockGoogleService();
    accountService = mockAccountService();
    twoFactorGate = mockTwoFactorGateService();
    jwtService = mockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleController],
      providers: [
        { provide: GoogleService, useValue: googleService },
        { provide: AccountService, useValue: accountService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
        { provide: JwtService, useValue: jwtService },
      ],
    })
      .overrideGuard(GoogleAuthGuard)
      .useValue(noopGuard)
      .compile();

    controller = module.get(GoogleController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── callback — sign-in path ─────────────────────────────────────────────────

  describe('callback — sign-in path', () => {
    it('calls findOrCreateUser, creates session lazily, sets cookies, and redirects to "/"', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      googleService.findOrCreateUser.mockResolvedValue(user);
      googleService.createSession.mockResolvedValue(tokens);

      const profile = makeGoogleProfile();
      const req = makeMockRequest(profile, {});
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(googleService.findOrCreateUser).toHaveBeenCalledWith(profile);
      expect(googleService.createSession).toHaveBeenCalledWith(
        user.id,
        user.role,
        expect.objectContaining({ ip: null, userAgent: null }),
      );
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ url: '/', statusCode: 302 });
    });

    it('passes extracted IP and userAgent to createSession', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      googleService.findOrCreateUser.mockResolvedValue(user);
      googleService.createSession.mockResolvedValue(tokens);

      const req = makeMockRequest(makeGoogleProfile(), {});
      const res = makeMockResponse();

      await controller.callback(req, '10.0.0.1, 172.16.0.1', 'jest-agent', res);

      expect(googleService.createSession).toHaveBeenCalledWith(
        user.id,
        user.role,
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
      );
    });

    it('redirects to the OAUTH_REDIRECT_COOKIE path when present', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      googleService.findOrCreateUser.mockResolvedValue(user);
      googleService.createSession.mockResolvedValue(makeTokens());

      const req = makeMockRequest(makeGoogleProfile(), {
        [OAUTH_REDIRECT_COOKIE]: '/dashboard',
      });
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({ url: '/dashboard', statusCode: 302 });
    });

    it('clears OAUTH_REDIRECT_COOKIE after sign-in', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      googleService.findOrCreateUser.mockResolvedValue(user);
      googleService.createSession.mockResolvedValue(makeTokens());

      const req = makeMockRequest(makeGoogleProfile(), {
        [OAUTH_REDIRECT_COOKIE]: '/dashboard',
      });
      const res = makeMockResponse();

      await controller.callback(req, undefined, undefined, res);

      expect(res.clearCookie).toHaveBeenCalledWith(OAUTH_REDIRECT_COOKIE, { path: '/' });
    });

    it('redirects to "/auth/two-factor" and does NOT create a session when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      googleService.findOrCreateUser.mockResolvedValue(user);
      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const req = makeMockRequest(makeGoogleProfile(), {});
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({ url: '/auth/two-factor', statusCode: 302 });
      expect(googleService.createSession).not.toHaveBeenCalled();
    });
  });

  // ─── callback — link path ────────────────────────────────────────────────────

  describe('callback — link path', () => {
    it('verifies JWT, calls accountService.linkAccount, and redirects to "/settings/accounts?linked=google"', async () => {
      const profile = makeGoogleProfile();
      const req = makeMockRequest(profile, {
        [LINK_INTENT_COOKIE]: 'google',
        [ACCESS_TOKEN_COOKIE]: 'valid-access-token',
      });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      const result = await controller.callback(req, undefined, undefined, res);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-access-token');
      expect(accountService.linkAccount).toHaveBeenCalledWith(
        'user-uuid',
        expect.objectContaining({
          providerId: profile.providerId,
          accountId: profile.accountId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        }),
      );
      expect(result).toEqual({ url: '/settings/accounts?linked=google', statusCode: 302 });
    });

    it('uses OAUTH_REDIRECT_COOKIE as the base redirect URL when present', async () => {
      const req = makeMockRequest(makeGoogleProfile(), {
        [LINK_INTENT_COOKIE]: 'google',
        [ACCESS_TOKEN_COOKIE]: 'valid-access-token',
        [OAUTH_REDIRECT_COOKIE]: '/settings/accounts',
      });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({ url: '/settings/accounts?linked=google', statusCode: 302 });
    });

    it('redirects with error=not_authenticated when no access_token cookie is present', async () => {
      const req = makeMockRequest(makeGoogleProfile(), {
        [LINK_INTENT_COOKIE]: 'google',
      });
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({
        url: '/settings/accounts?error=not_authenticated',
        statusCode: 302,
      });
      expect(accountService.linkAccount).not.toHaveBeenCalled();
    });

    it('redirects with error=session_expired when JWT verification throws', async () => {
      const req = makeMockRequest(makeGoogleProfile(), {
        [LINK_INTENT_COOKIE]: 'google',
        [ACCESS_TOKEN_COOKIE]: 'expired-token',
      });
      const res = makeMockResponse();

      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({
        url: '/settings/accounts?error=session_expired',
        statusCode: 302,
      });
      expect(accountService.linkAccount).not.toHaveBeenCalled();
    });

    it('redirects with encoded error message when accountService.linkAccount throws', async () => {
      const req = makeMockRequest(makeGoogleProfile(), {
        [LINK_INTENT_COOKIE]: 'google',
        [ACCESS_TOKEN_COOKIE]: 'valid-access-token',
      });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockRejectedValue(
        new Error('This google account is already linked'),
      );

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({
        url: `/settings/accounts?error=${encodeURIComponent('This google account is already linked')}`,
        statusCode: 302,
      });
    });

    it("falls back to 'link_failed' when a non-Error is thrown by accountService.linkAccount", async () => {
      const req = makeMockRequest(makeGoogleProfile(), {
        [LINK_INTENT_COOKIE]: 'google',
        [ACCESS_TOKEN_COOKIE]: 'valid-access-token',
      });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockRejectedValue('raw string error');

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({ url: '/settings/accounts?error=link_failed', statusCode: 302 });
    });

    it('clears LINK_INTENT_COOKIE and OAUTH_REDIRECT_COOKIE before handling link callback', async () => {
      const req = makeMockRequest(makeGoogleProfile(), {
        [LINK_INTENT_COOKIE]: 'google',
        [ACCESS_TOKEN_COOKIE]: 'valid-access-token',
      });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      await controller.callback(req, undefined, undefined, res);

      expect(res.clearCookie).toHaveBeenCalledWith(LINK_INTENT_COOKIE, { path: '/' });
      expect(res.clearCookie).toHaveBeenCalledWith(OAUTH_REDIRECT_COOKIE, { path: '/' });
    });
  });
});
