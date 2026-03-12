import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { LINK_INTENT_COOKIE, LINK_INTENT_EXPIRES_MS } from '../auth/auth.constants';
import type { Request as ExpressRequest, Response } from 'express';

const mockAccountService = () => ({
  listAccounts: jest.fn(),
  linkAccount: jest.fn(),
  unlinkAccount: jest.fn(),
});

const makeMockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  }) as unknown as Response;

const makeMockRequest = (
  overrides: Partial<{ userId: string }> = {},
): ExpressRequest & { user: { userId: string } } =>
  ({
    user: { userId: overrides.userId ?? 'user-uuid' },
    cookies: {},
  }) as unknown as ExpressRequest & { user: { userId: string } };

describe('AccountController', () => {
  let controller: AccountController;
  let accountService: ReturnType<typeof mockAccountService>;

  beforeEach(async () => {
    accountService = mockAccountService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        { provide: AccountService, useValue: accountService },
      ],
    }).compile();

    controller = module.get(AccountController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── listAccounts ────────────────────────────────────────────────────────────

  describe('listAccounts', () => {
    it('calls accountService.listAccounts with userId from request and returns result', async () => {
      const accounts = [{ id: 'account-uuid', providerId: 'google' }];
      accountService.listAccounts.mockResolvedValue(accounts);

      const req = makeMockRequest({ userId: 'user-uuid' });

      const result = await controller.listAccounts(req);

      expect(accountService.listAccounts).toHaveBeenCalledWith('user-uuid');
      expect(result).toBe(accounts);
    });
  });

  // ─── linkAccount ─────────────────────────────────────────────────────────────

  describe('linkAccount', () => {
    it('sets LINK_INTENT_COOKIE with the providerId', () => {
      const res = makeMockResponse();

      controller.linkAccount('google', res);

      expect(res.cookie).toHaveBeenCalledWith(
        LINK_INTENT_COOKIE,
        'google',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: LINK_INTENT_EXPIRES_MS,
        }),
      );
    });

    it('redirects to /api/auth/:providerId', () => {
      const res = makeMockResponse();

      controller.linkAccount('google', res);

      expect(res.redirect).toHaveBeenCalledWith('/api/auth/google');
    });

    it('sets secure: false when NODE_ENV is not production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = makeMockResponse();
      controller.linkAccount('google', res);

      expect(res.cookie).toHaveBeenCalledWith(
        LINK_INTENT_COOKIE,
        'google',
        expect.objectContaining({ secure: false }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('sets secure: true when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = makeMockResponse();
      controller.linkAccount('google', res);

      expect(res.cookie).toHaveBeenCalledWith(
        LINK_INTENT_COOKIE,
        'google',
        expect.objectContaining({ secure: true }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  // ─── unlinkAccount ───────────────────────────────────────────────────────────

  describe('unlinkAccount', () => {
    it('calls accountService.unlinkAccount with userId and id; returns { success: true }', async () => {
      accountService.unlinkAccount.mockResolvedValue(undefined);

      const req = makeMockRequest({ userId: 'user-uuid' });

      const result = await controller.unlinkAccount(req, 'account-uuid');

      expect(accountService.unlinkAccount).toHaveBeenCalledWith(
        'user-uuid',
        'account-uuid',
      );
      expect(result).toEqual({ success: true });
    });

    it('propagates NotFoundException when service throws', async () => {
      accountService.unlinkAccount.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      const req = makeMockRequest({ userId: 'user-uuid' });

      await expect(
        controller.unlinkAccount(req, 'missing-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
