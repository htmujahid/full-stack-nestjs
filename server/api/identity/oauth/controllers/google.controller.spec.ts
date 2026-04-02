import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GoogleController } from './google.controller';
import { AccountService } from '../../account/account.service';
import { AuthService } from '../../auth/services/auth.service';
import { TwoFactorGateService } from '../../auth/services/two-factor-gate.service';
import { UserService } from '../../user/user.service';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import { OAUTH_REDIRECT_COOKIE } from '../../auth/auth.constants';
import type { OAuthProfile as GoogleProfile } from '../../auth/types';
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

const makeGoogleProfile = (
  overrides: Partial<GoogleProfile> = {},
): GoogleProfile => ({
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

const mockUserService = () => ({ findOrCreateUser: jest.fn() });
const mockAuthService = () => ({ createAuthSession: jest.fn() });

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
  let userService: ReturnType<typeof mockUserService>;
  let authService: ReturnType<typeof mockAuthService>;
  let accountService: ReturnType<typeof mockAccountService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(async () => {
    userService = mockUserService();
    authService = mockAuthService();
    accountService = mockAccountService();
    twoFactorGate = mockTwoFactorGateService();
    jwtService = mockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
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
      userService.findOrCreateUser.mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue(tokens);

      const profile = makeGoogleProfile();
      const req = makeMockRequest(profile, {});
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(userService.findOrCreateUser).toHaveBeenCalledWith(profile);
      expect(authService.createAuthSession).toHaveBeenCalledWith(
        user.id,
        user.role,
        true,
        expect.objectContaining({ ip: null, userAgent: null }),
        'google',
      );
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ url: '/', statusCode: 302 });
    });

    it('passes extracted IP and userAgent to createAuthSession', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      userService.findOrCreateUser.mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue(tokens);

      const req = makeMockRequest(makeGoogleProfile(), {});
      const res = makeMockResponse();

      await controller.callback(req, '10.0.0.1, 172.16.0.1', 'jest-agent', res);

      expect(authService.createAuthSession).toHaveBeenCalledWith(
        user.id,
        user.role,
        true,
        { ip: '10.0.0.1', userAgent: 'jest-agent' },
        'google',
      );
    });

    it('redirects to the OAUTH_REDIRECT_COOKIE path when present', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      userService.findOrCreateUser.mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue(makeTokens());

      const req = makeMockRequest(makeGoogleProfile(), {
        [OAUTH_REDIRECT_COOKIE]: '/dashboard',
      });
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({ url: '/dashboard', statusCode: 302 });
    });

    it('clears OAUTH_REDIRECT_COOKIE after sign-in', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      userService.findOrCreateUser.mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue(makeTokens());

      const req = makeMockRequest(makeGoogleProfile(), {
        [OAUTH_REDIRECT_COOKIE]: '/dashboard',
      });
      const res = makeMockResponse();

      await controller.callback(req, undefined, undefined, res);

      expect(res.clearCookie).toHaveBeenCalledWith(OAUTH_REDIRECT_COOKIE, {
        path: '/',
      });
    });

    it('redirects to "/auth/two-factor" and does NOT create a session when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      userService.findOrCreateUser.mockResolvedValue(user);
      twoFactorGate.checkTrustDevice.mockResolvedValue(false);
      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const req = makeMockRequest(makeGoogleProfile(), {});
      const res = makeMockResponse();

      const result = await controller.callback(req, undefined, undefined, res);

      expect(result).toEqual({ url: '/auth/two-factor', statusCode: 302 });
      expect(authService.createAuthSession).not.toHaveBeenCalled();
    });
  });
});
