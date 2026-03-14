import { Test, TestingModule } from '@nestjs/testing';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import type { Request as ExpressRequest } from 'express';

const mockAccountService = () => ({
  listAccounts: jest.fn(),
});

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
});
