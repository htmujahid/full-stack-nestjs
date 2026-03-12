import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountService, type LinkAccountData } from './account.service';
import { Account } from './account.entity';
import { mockRepository } from '../../../mocks/db.mock';

const makeAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'account-uuid',
    userId: 'user-uuid',
    providerId: 'google',
    accountId: 'google-account-id',
    accessToken: null,
    refreshToken: null,
    scope: null,
    accessTokenExpiresAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as Account;

const makeLinkData = (overrides: Partial<LinkAccountData> = {}): LinkAccountData => ({
  providerId: 'google',
  accountId: 'google-account-id',
  ...overrides,
});

describe('AccountService', () => {
  let service: AccountService;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    repo = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: getRepositoryToken(Account), useValue: repo },
      ],
    }).compile();
    service = module.get(AccountService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── listAccounts ────────────────────────────────────────────────────────────

  describe('listAccounts', () => {
    it('calls find with correct where, select, and order', async () => {
      repo.find.mockResolvedValue([]);

      await service.listAccounts('user-uuid');

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        select: {
          id: true,
          providerId: true,
          accountId: true,
          scope: true,
          accessTokenExpiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
        order: { createdAt: 'ASC' },
      });
    });

    it('returns the array returned by the repository', async () => {
      const accounts = [makeAccount()];
      repo.find.mockResolvedValue(accounts);

      const result = await service.listAccounts('user-uuid');

      expect(result).toBe(accounts);
    });

    it('returns an empty array when there are no accounts', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.listAccounts('user-uuid');

      expect(result).toEqual([]);
    });
  });

  // ─── linkAccount ─────────────────────────────────────────────────────────────

  describe('linkAccount', () => {
    it('creates and saves a new account when no conflicts exist', async () => {
      const data = makeLinkData();
      const created = makeAccount();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.linkAccount('user-uuid', data);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid',
          providerId: data.providerId,
          accountId: data.accountId,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(created);
    });

    it('sets accessToken, refreshToken, scope to null when not provided', async () => {
      const data = makeLinkData(); // no optional fields
      const created = makeAccount();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.linkAccount('user-uuid', data);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: null,
          refreshToken: null,
          scope: null,
        }),
      );
    });

    it('persists accessToken, refreshToken, scope when provided', async () => {
      const data = makeLinkData({ accessToken: 'at', refreshToken: 'rt', scope: 'email' });
      const created = makeAccount({ accessToken: 'at', refreshToken: 'rt', scope: 'email' });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.linkAccount('user-uuid', data);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'at', refreshToken: 'rt', scope: 'email' }),
      );
    });

    it('throws BadRequestException when same provider+accountId is already linked to THIS user', async () => {
      const data = makeLinkData();
      // First findOne: the provider+accountId combo, owned by the same user
      repo.findOne.mockResolvedValueOnce(makeAccount({ userId: 'user-uuid' }));

      await expect(service.linkAccount('user-uuid', data)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when same provider+accountId is linked to a DIFFERENT user', async () => {
      const data = makeLinkData();
      // First findOne: the provider+accountId combo, owned by another user
      repo.findOne.mockResolvedValueOnce(makeAccount({ userId: 'other-user-uuid' }));

      await expect(service.linkAccount('user-uuid', data)).rejects.toThrow(BadRequestException);
    });

    it('includes the provider name in the error message — already linked to this user', async () => {
      const data = makeLinkData({ providerId: 'github' });
      repo.findOne.mockResolvedValueOnce(makeAccount({ userId: 'user-uuid', providerId: 'github' }));

      await expect(service.linkAccount('user-uuid', data)).rejects.toThrow(/github/);
    });

    it('includes the provider name in the error message — linked to another account', async () => {
      const data = makeLinkData({ providerId: 'github' });
      repo.findOne.mockResolvedValueOnce(makeAccount({ userId: 'other-uuid', providerId: 'github' }));

      await expect(service.linkAccount('user-uuid', data)).rejects.toThrow(/github/);
    });

    it('throws BadRequestException when user already has a different account for this provider', async () => {
      const data = makeLinkData({ accountId: 'new-google-id' });
      // First findOne (provider+accountId): no match
      repo.findOne.mockResolvedValueOnce(null);
      // Second findOne (userId+providerId): user already has a google account
      repo.findOne.mockResolvedValueOnce(makeAccount({ accountId: 'existing-google-id' }));

      await expect(service.linkAccount('user-uuid', data)).rejects.toThrow(BadRequestException);
    });

    it('does not call save when conflicts are detected', async () => {
      const data = makeLinkData();
      repo.findOne.mockResolvedValueOnce(makeAccount({ userId: 'other-uuid' }));

      await expect(service.linkAccount('user-uuid', data)).rejects.toThrow();

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ─── unlinkAccount ───────────────────────────────────────────────────────────

  describe('unlinkAccount', () => {
    it('removes the account when it exists and is not the last one', async () => {
      const account = makeAccount();
      repo.findOne.mockResolvedValue(account);
      repo.count.mockResolvedValue(2);

      // mockRepository does not include remove, add it
      const removeMock = jest.fn().mockResolvedValue(account);
      (repo as typeof repo & { remove: jest.Mock }).remove = removeMock;

      await service.unlinkAccount('user-uuid', 'account-uuid');

      expect(removeMock).toHaveBeenCalledWith(account);
    });

    it('throws NotFoundException when account is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.unlinkAccount('user-uuid', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the account is the last authentication method', async () => {
      const account = makeAccount();
      repo.findOne.mockResolvedValue(account);
      repo.count.mockResolvedValue(1);

      await expect(service.unlinkAccount('user-uuid', 'account-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('queries with both id and userId to prevent cross-user unlink', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.unlinkAccount('user-uuid', 'account-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'account-uuid', userId: 'user-uuid' },
      });
    });

    it('counts only accounts belonging to the requesting user', async () => {
      const account = makeAccount();
      repo.findOne.mockResolvedValue(account);
      repo.count.mockResolvedValue(2);

      const removeMock = jest.fn().mockResolvedValue(account);
      (repo as typeof repo & { remove: jest.Mock }).remove = removeMock;

      await service.unlinkAccount('user-uuid', 'account-uuid');

      expect(repo.count).toHaveBeenCalledWith({ where: { userId: 'user-uuid' } });
    });

    it('does not call remove when it is the last account', async () => {
      const account = makeAccount();
      repo.findOne.mockResolvedValue(account);
      repo.count.mockResolvedValue(1);

      const removeMock = jest.fn();
      (repo as typeof repo & { remove: jest.Mock }).remove = removeMock;

      await expect(service.unlinkAccount('user-uuid', 'account-uuid')).rejects.toThrow();

      expect(removeMock).not.toHaveBeenCalled();
    });
  });
});
