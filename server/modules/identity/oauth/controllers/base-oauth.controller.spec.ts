import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BaseOAuthController, type OAuthProfile } from './base-oauth.controller';
import { AccountService } from '../../account/account.service';
import { AuthService } from '../../auth/services/auth.service';
import { TwoFactorGateService } from '../../auth/services/two-factor-gate.service';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import { Account } from '../../account/account.entity';
import { mockDataSource, mockRepository } from '../../../../mocks/db.mock';
import { GOOGLE_PROVIDER } from '../../auth/auth.constants';
import type { TokenPair } from '../../auth/services/auth.service';

const NOW = 2_000_000_000_000;

class TestOAuthController extends BaseOAuthController {
  constructor(
    twoFactorGate: TwoFactorGateService,
    accountService: AccountService,
    jwtService: JwtService,
    dataSource: DataSource,
    authService: AuthService,
  ) {
    super(twoFactorGate, accountService, jwtService, dataSource, authService);
  }
}

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Google User',
    email: 'google@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: 'https://example.com/photo.jpg',
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as User;

const makeAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'account-uuid',
    userId: 'user-uuid',
    providerId: GOOGLE_PROVIDER,
    accountId: 'google-account-id',
    accessToken: 'access-token',
    refreshToken: null,
    ...overrides,
  }) as Account;

const makeProfile = (overrides: Partial<OAuthProfile> = {}): OAuthProfile => ({
  providerId: GOOGLE_PROVIDER,
  accountId: 'google-account-id',
  email: 'google@example.com',
  name: 'Google User',
  image: 'https://example.com/photo.jpg',
  accessToken: 'new-access-token',
  refreshToken: 'new-refresh-token',
  ...overrides,
});

const makeTokenPair = (): TokenPair => ({
  accessToken: 'access',
  refreshToken: 'refresh',
  refreshExpiresAt: new Date(NOW + 2_592_000_000),
});

describe('BaseOAuthController', () => {
  let controller: TestOAuthController;
  let dataSource: ReturnType<typeof mockDataSource>;
  let authService: { createAuthSession: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    authService = { createAuthSession: jest.fn().mockResolvedValue(makeTokenPair()) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestOAuthController],
      providers: [
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuthService, useValue: authService },
        {
          provide: AccountService,
          useValue: { listAccounts: jest.fn(), linkAccount: jest.fn(), unlinkAccount: jest.fn() },
        },
        {
          provide: TwoFactorGateService,
          useValue: {
            checkTrustDevice: jest.fn(),
            createPendingToken: jest.fn(),
            rotateTrustDevice: jest.fn(),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn(), sign: jest.fn() } },
      ],
    }).compile();

    controller = module.get(TestOAuthController);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── findOrCreateUser ────────────────────────────────────────────────────────

  describe('findOrCreateUser', () => {
    it('returns existing user and updates tokens when account already exists', async () => {
      const existingAccount = makeAccount();
      const existingUser = makeUser();

      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(existingAccount);
      txRepo.findOneOrFail.mockResolvedValue(existingUser);
      txRepo.update.mockResolvedValue({ affected: 1, raw: [] });

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      const result = await controller.findOrCreateUser(makeProfile());

      expect(result).toBe(existingUser);
      expect(txRepo.update).toHaveBeenCalledWith(
        existingAccount.id,
        expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        }),
      );
    });

    it('creates a new user and account when no account exists and email not in use', async () => {
      const profile = makeProfile();
      const newUser = makeUser();
      const newAccount = makeAccount();

      const txRepo = mockRepository();
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      txRepo.create.mockReturnValueOnce(newUser).mockReturnValueOnce(newAccount);
      txRepo.save.mockResolvedValueOnce(newUser).mockResolvedValueOnce(newAccount);

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      const result = await controller.findOrCreateUser(profile);

      expect(result).toBe(newUser);
      expect(txRepo.create).toHaveBeenCalledTimes(2);
      expect(txRepo.save).toHaveBeenCalledTimes(2);
    });

    it('creates new user with emailVerified=true when no existing user or account', async () => {
      const profile = makeProfile();
      const newUser = makeUser({ emailVerified: true });

      const txRepo = mockRepository();
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      txRepo.create.mockReturnValueOnce(newUser).mockReturnValueOnce(makeAccount());
      txRepo.save.mockResolvedValueOnce(newUser).mockResolvedValueOnce(makeAccount());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await controller.findOrCreateUser(profile);

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true }),
      );
    });

    it('normalizes email to lowercase when creating a new user', async () => {
      const profile = makeProfile({ email: 'GOOGLE@EXAMPLE.COM' });
      const newUser = makeUser({ email: 'google@example.com' });

      const txRepo = mockRepository();
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      txRepo.create.mockReturnValueOnce(newUser).mockReturnValueOnce(makeAccount());
      txRepo.save.mockResolvedValueOnce(newUser).mockResolvedValueOnce(makeAccount());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await controller.findOrCreateUser(profile);

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'google@example.com' }),
      );
    });

    it('links account to existing user when email already in use', async () => {
      const profile = makeProfile();
      const existingUser = makeUser({ emailVerified: true });
      const newAccount = makeAccount();

      const txRepo = mockRepository();
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      txRepo.create.mockReturnValue(newAccount);
      txRepo.save.mockResolvedValue(newAccount);

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      const result = await controller.findOrCreateUser(profile);

      expect(result).toBe(existingUser);
      expect(txRepo.save).toHaveBeenCalledTimes(1);
    });

    it('marks emailVerified=true for existing user who is not yet verified', async () => {
      const profile = makeProfile();
      const existingUser = makeUser({ emailVerified: false });

      const txRepo = mockRepository();
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      txRepo.update.mockResolvedValue({ affected: 1, raw: [] });
      txRepo.create.mockReturnValue(makeAccount());
      txRepo.save.mockResolvedValue(makeAccount());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await controller.findOrCreateUser(profile);

      expect(txRepo.update).toHaveBeenCalledWith(
        existingUser.id,
        { emailVerified: true },
      );
    });

    it('saves new account with providerId and profile accountId', async () => {
      const profile = makeProfile({ accountId: 'gid-12345' });
      const newUser = makeUser();
      const newAccount = makeAccount({ accountId: 'gid-12345' });

      const txRepo = mockRepository();
      txRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      txRepo.create.mockReturnValueOnce(newUser).mockReturnValueOnce(newAccount);
      txRepo.save.mockResolvedValueOnce(newUser).mockResolvedValueOnce(newAccount);

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await controller.findOrCreateUser(profile);

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: GOOGLE_PROVIDER,
          accountId: 'gid-12345',
        }),
      );
    });

    it('searches for account by providerId and profile accountId', async () => {
      const profile = makeProfile({ accountId: 'gid-12345' });

      const txRepo = mockRepository();
      txRepo.findOne.mockResolvedValue(null);
      txRepo.create.mockReturnValue(makeUser());
      txRepo.save.mockResolvedValue(makeUser());

      dataSource.transaction.mockImplementation(async (cb) => {
        const tx = { getRepository: jest.fn().mockReturnValue(txRepo) };
        return cb(tx);
      });

      await controller.findOrCreateUser(profile);

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { providerId: GOOGLE_PROVIDER, accountId: 'gid-12345' },
      });
    });
  });
});
