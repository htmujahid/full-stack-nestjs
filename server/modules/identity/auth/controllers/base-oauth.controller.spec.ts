import { JwtService } from '@nestjs/jwt';
import type { Request as ExpressRequest, Response } from 'express';
import { BaseOAuthController } from './base-oauth.controller';
import { TwoFactorGateService } from '../services/two-factor-gate.service';
import { AccountService } from '../../account/account.service';
import { UserRole } from '../../user/user-role.enum';
import type { TokenPair } from '../services/auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  OAUTH_REDIRECT_COOKIE,
  TRUST_DEVICE_COOKIE,
} from '../auth.constants';

// ─── Concrete subclass exposing protected methods for testing ─────────────────
// Instantiated directly (not via TestingModule) so that constructor injection
// works without NestJS decorator metadata on the test-only subclass.

class TestOAuthController extends BaseOAuthController {
  constructor(
    twoFactorGate: TwoFactorGateService,
    accountService: AccountService,
    jwtService: JwtService,
  ) {
    super(twoFactorGate, accountService, jwtService);
  }

  testHandleOAuthLink = (
    req: ExpressRequest,
    res: Response,
    account: { providerId: string; accountId: string; accessToken: string; refreshToken: string | null },
  ) => this.handleOAuthLink(req, res, account);

  testHandleOAuthSignIn = (
    req: ExpressRequest,
    res: Response,
    user: { id: string; role: UserRole; twoFactorEnabled: boolean },
    createTokens: () => Promise<TokenPair>,
  ) => this.handleOAuthSignIn(req, res, user, createTokens);
}

// ─── Factories ────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<{ id: string; role: UserRole; twoFactorEnabled: boolean }> = {}) => ({
  id: 'user-uuid',
  role: UserRole.Member,
  twoFactorEnabled: false,
  ...overrides,
});

const makeAccount = (overrides: Partial<{ providerId: string; accountId: string; accessToken: string; refreshToken: string | null }> = {}) => ({
  providerId: 'google',
  accountId: 'google-account-id',
  accessToken: 'google-access-token',
  refreshToken: null,
  ...overrides,
});

const makeTokens = (): TokenPair => ({
  accessToken: 'access-jwt',
  refreshToken: 'refresh-jwt',
  refreshExpiresAt: new Date(),
});

const makeMockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  }) as unknown as Response;

const makeMockRequest = (cookies: Record<string, string> = {}): ExpressRequest =>
  ({ cookies }) as unknown as ExpressRequest;

const mockTwoFactorGateService = () => ({
  checkTrustDevice: jest.fn(),
  createPendingToken: jest.fn(),
  rotateTrustDevice: jest.fn(),
});

const mockAccountService = () => ({
  listAccounts: jest.fn(),
  linkAccount: jest.fn(),
  unlinkAccount: jest.fn(),
});

const mockJwtService = () => ({
  verify: jest.fn(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BaseOAuthController', () => {
  let controller: TestOAuthController;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;
  let accountService: ReturnType<typeof mockAccountService>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(() => {
    twoFactorGate = mockTwoFactorGateService();
    accountService = mockAccountService();
    jwtService = mockJwtService();

    controller = new TestOAuthController(
      twoFactorGate as unknown as TwoFactorGateService,
      accountService as unknown as AccountService,
      jwtService as unknown as JwtService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  // ─── handleOAuthLink ─────────────────────────────────────────────────────────

  describe('handleOAuthLink', () => {
    it('redirects to "/settings/accounts?linked=<providerId>" when no OAUTH_REDIRECT_COOKIE is present', async () => {
      const account = makeAccount({ providerId: 'google' });
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'valid-token' });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      const result = await controller.testHandleOAuthLink(req, res, account);

      expect(result).toEqual({ url: '/settings/accounts?linked=google', statusCode: 302 });
    });

    it('uses OAUTH_REDIRECT_COOKIE as the base URL when the cookie is present', async () => {
      const account = makeAccount({ providerId: 'google' });
      const req = makeMockRequest({
        [ACCESS_TOKEN_COOKIE]: 'valid-token',
        [OAUTH_REDIRECT_COOKIE]: '/settings/accounts',
      });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      const result = await controller.testHandleOAuthLink(req, res, account);

      expect(result).toEqual({ url: '/settings/accounts?linked=google', statusCode: 302 });
    });

    it('always clears OAUTH_REDIRECT_COOKIE', async () => {
      const account = makeAccount();
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'valid-token' });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      await controller.testHandleOAuthLink(req, res, account);

      expect(res.clearCookie).toHaveBeenCalledWith(OAUTH_REDIRECT_COOKIE, { path: '/' });
    });

    it('redirects with error=not_authenticated when no ACCESS_TOKEN_COOKIE is present', async () => {
      const account = makeAccount();
      const req = makeMockRequest({}); // no access_token
      const res = makeMockResponse();

      const result = await controller.testHandleOAuthLink(req, res, account);

      expect(result).toEqual({
        url: '/settings/accounts?error=not_authenticated',
        statusCode: 302,
      });
      expect(accountService.linkAccount).not.toHaveBeenCalled();
    });

    it('redirects with error=session_expired when JWT verification throws', async () => {
      const account = makeAccount();
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'expired-token' });
      const res = makeMockResponse();

      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await controller.testHandleOAuthLink(req, res, account);

      expect(result).toEqual({
        url: '/settings/accounts?error=session_expired',
        statusCode: 302,
      });
      expect(accountService.linkAccount).not.toHaveBeenCalled();
    });

    it('redirects with encoded error message when linkAccount throws an Error', async () => {
      const account = makeAccount();
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'valid-token' });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockRejectedValue(
        new Error('This google account is already linked'),
      );

      const result = await controller.testHandleOAuthLink(req, res, account);

      expect(result).toEqual({
        url: `/settings/accounts?error=${encodeURIComponent('This google account is already linked')}`,
        statusCode: 302,
      });
    });

    it('redirects with error=link_failed when linkAccount throws a non-Error', async () => {
      const account = makeAccount();
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'valid-token' });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockRejectedValue('raw string error');

      const result = await controller.testHandleOAuthLink(req, res, account);

      expect(result).toEqual({
        url: '/settings/accounts?error=link_failed',
        statusCode: 302,
      });
    });

    it('calls jwtService.verify with the access token cookie value', async () => {
      const account = makeAccount();
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'bearer-token' });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      accountService.linkAccount.mockResolvedValue(undefined);

      await controller.testHandleOAuthLink(req, res, account);

      expect(jwtService.verify).toHaveBeenCalledWith('bearer-token');
    });

    it('calls accountService.linkAccount with the resolved userId and account data', async () => {
      const account = makeAccount({ providerId: 'google', accountId: 'gid', accessToken: 'gat', refreshToken: 'grt' });
      const req = makeMockRequest({ [ACCESS_TOKEN_COOKIE]: 'valid-token' });
      const res = makeMockResponse();

      jwtService.verify.mockReturnValue({ sub: 'resolved-user-id' });
      accountService.linkAccount.mockResolvedValue(undefined);

      await controller.testHandleOAuthLink(req, res, account);

      expect(accountService.linkAccount).toHaveBeenCalledWith(
        'resolved-user-id',
        expect.objectContaining({
          providerId: 'google',
          accountId: 'gid',
          accessToken: 'gat',
          refreshToken: 'grt',
        }),
      );
    });
  });

  // ─── handleOAuthSignIn ───────────────────────────────────────────────────────

  describe('handleOAuthSignIn', () => {
    it('calls createTokens, sets cookies, and redirects to "/" when 2FA is not enabled', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      const createTokens = jest.fn<Promise<TokenPair>, []>().mockResolvedValue(tokens);
      const req = makeMockRequest({});
      const res = makeMockResponse();

      const result = await controller.testHandleOAuthSignIn(req, res, user, createTokens);

      expect(createTokens).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ url: '/', statusCode: 302 });
    });

    it('redirects to OAUTH_REDIRECT_COOKIE path when cookie is present', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      const createTokens = jest.fn<Promise<TokenPair>, []>().mockResolvedValue(tokens);
      const req = makeMockRequest({ [OAUTH_REDIRECT_COOKIE]: '/dashboard' });
      const res = makeMockResponse();

      const result = await controller.testHandleOAuthSignIn(req, res, user, createTokens);

      expect(result).toEqual({ url: '/dashboard', statusCode: 302 });
    });

    it('always clears OAUTH_REDIRECT_COOKIE', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const createTokens = jest.fn<Promise<TokenPair>, []>().mockResolvedValue(makeTokens());
      const req = makeMockRequest({ [OAUTH_REDIRECT_COOKIE]: '/dashboard' });
      const res = makeMockResponse();

      await controller.testHandleOAuthSignIn(req, res, user, createTokens);

      expect(res.clearCookie).toHaveBeenCalledWith(OAUTH_REDIRECT_COOKIE, { path: '/' });
    });

    it('returns { url: "/auth/two-factor" } and does NOT call createTokens when 2FA gate is pending', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const createTokens = jest.fn<Promise<TokenPair>, []>();
      const req = makeMockRequest({}); // no trust_device cookie → isTrusted=false → pending
      const res = makeMockResponse();

      twoFactorGate.createPendingToken.mockResolvedValue('pending-jwt');

      const result = await controller.testHandleOAuthSignIn(req, res, user, createTokens);

      expect(result).toEqual({ url: '/auth/two-factor', statusCode: 302 });
      expect(createTokens).not.toHaveBeenCalled();
    });

    it('calls createTokens only after the 2FA gate passes (trusted device)', async () => {
      const user = makeUser({ twoFactorEnabled: true });
      const tokens = makeTokens();
      const createTokens = jest.fn<Promise<TokenPair>, []>().mockResolvedValue(tokens);
      const req = makeMockRequest({ [TRUST_DEVICE_COOKIE]: 'valid-trust-token' });
      const res = makeMockResponse();

      twoFactorGate.checkTrustDevice.mockResolvedValue(true);
      twoFactorGate.rotateTrustDevice.mockResolvedValue('rotated-trust-token');

      const result = await controller.testHandleOAuthSignIn(req, res, user, createTokens);

      expect(createTokens).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ url: '/', statusCode: 302 });
    });

    it('sets token cookies with sameSite "lax" (OAuth uses lax not strict)', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      const tokens = makeTokens();
      const createTokens = jest.fn<Promise<TokenPair>, []>().mockResolvedValue(tokens);
      const req = makeMockRequest({});
      const res = makeMockResponse();

      await controller.testHandleOAuthSignIn(req, res, user, createTokens);

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        tokens.accessToken,
        expect.objectContaining({ sameSite: 'lax' }),
      );
    });
  });
});
