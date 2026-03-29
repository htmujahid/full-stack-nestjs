import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PasswordAuthStrategy } from './password-auth.strategy';
import { User } from '../../user/user.entity';
import { Account } from '../../account/account.entity';
import { mockRepository } from '../../../../mocks/db.mock';

jest.mock('bcrypt');

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    username: 'testuser',
    phone: '+1234567890',
    phoneVerified: true,
    emailVerified: true,
    twoFactorEnabled: false,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const makeAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'account-uuid',
    userId: 'user-uuid',
    providerId: 'credential',
    password: 'hashed-password',
    ...overrides,
  }) as Account;

describe('PasswordAuthStrategy', () => {
  let strategy: PasswordAuthStrategy;
  let userRepo: ReturnType<typeof mockRepository>;
  let accountRepo: ReturnType<typeof mockRepository>;
  let dataSource: jest.Mocked<Pick<DataSource, 'getRepository'>>;

  beforeEach(() => {
    userRepo = mockRepository();
    accountRepo = mockRepository();

    dataSource = {
      getRepository: jest
        .fn()
        .mockImplementation((entity: unknown) =>
          entity === User ? userRepo : accountRepo,
        ),
    } as unknown as jest.Mocked<Pick<DataSource, 'getRepository'>>;

    strategy = new PasswordAuthStrategy(dataSource as unknown as DataSource);

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    it('resolves user by email when identifier contains "@"', async () => {
      const user = makeUser();
      const account = makeAccount();
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(account);

      await strategy.validate('test@example.com', 'password');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('resolves user by username when identifier has no "@" and username matches', async () => {
      const user = makeUser();
      const account = makeAccount();
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(account);

      await strategy.validate('testuser', 'password');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('resolves user by phone when no email/username match', async () => {
      const user = makeUser();
      const account = makeAccount();
      // first call (username lookup) returns null, second (phone lookup) returns user
      userRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
      accountRepo.findOne.mockResolvedValue(account);

      await strategy.validate('+1234567890', 'password');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { phone: '+1234567890' },
      });
    });

    it('throws UnauthorizedException and calls bcrypt.hash for timing when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        strategy.validate('ghost@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.hash).toHaveBeenCalled();
    });

    it('throws UnauthorizedException and calls bcrypt.hash when user has no credential account', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        strategy.validate('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.hash).toHaveBeenCalled();
    });

    it('throws UnauthorizedException and calls bcrypt.hash when account has no password', async () => {
      const user = makeUser();
      const account = makeAccount({ password: null as unknown as string });
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(account);

      await expect(
        strategy.validate('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.hash).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      const user = makeUser();
      const account = makeAccount();
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(account);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        strategy.validate('test@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when email is not verified', async () => {
      const user = makeUser({ emailVerified: false });
      const account = makeAccount();
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(account);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        strategy.validate('test@example.com', 'password'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns user on successful validation', async () => {
      const user = makeUser({ emailVerified: true });
      const account = makeAccount();
      userRepo.findOne.mockResolvedValue(user);
      accountRepo.findOne.mockResolvedValue(account);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await strategy.validate('test@example.com', 'password');

      expect(result).toBe(user);
    });
  });
});
