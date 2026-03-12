import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PoliciesGuard } from './policies.guard';
import { CaslAbilityFactory, AppAbility } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, IPolicyHandler } from './check-policies.decorator';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const makeContext = (
  handlers: unknown[] | undefined,
  user: { userId: string } | undefined,
): ExecutionContext => {
  const getRequest = jest.fn().mockReturnValue({ user });
  const switchToHttp = jest.fn().mockReturnValue({ getRequest });
  const getHandler = jest.fn();
  return { switchToHttp, getHandler } as unknown as ExecutionContext;
};

describe('PoliciesGuard', () => {
  let guard: PoliciesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'get'>>;
  let caslAbilityFactory: jest.Mocked<Pick<CaslAbilityFactory, 'createForUser'>>;
  let userRepo: ReturnType<typeof mockRepository> & { findOneBy: jest.Mock };

  beforeEach(async () => {
    userRepo = { ...mockRepository(), findOneBy: jest.fn() };

    reflector = { get: jest.fn() };
    caslAbilityFactory = { createForUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: CaslAbilityFactory, useValue: caslAbilityFactory },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    guard = module.get(PoliciesGuard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('returns true when no policy handlers are registered', async () => {
      const context = makeContext(undefined, undefined);
      reflector.get.mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('returns true when an empty array of handlers is registered', async () => {
      const context = makeContext([], undefined);
      reflector.get.mockReturnValue([]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('throws ForbiddenException when req.user is missing', async () => {
      const context = makeContext([jest.fn()], undefined);
      reflector.get.mockReturnValue([jest.fn()]);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user is not found in DB', async () => {
      const context = makeContext([jest.fn()], { userId: 'user-1' });
      reflector.get.mockReturnValue([jest.fn()]);
      userRepo.findOneBy.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a function-based policy handler returns false', async () => {
      const user = makeUser();
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler = jest.fn().mockReturnValue(false);

      const context = makeContext([handler], { userId: user.id });
      reflector.get.mockReturnValue([handler]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(handler).toHaveBeenCalledWith(mockAbility);
    });

    it('throws ForbiddenException when a class-based policy handler returns false', async () => {
      const user = makeUser();
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;

      const classHandler: IPolicyHandler = { handle: jest.fn().mockReturnValue(false) };

      const context = makeContext([classHandler], { userId: user.id });
      reflector.get.mockReturnValue([classHandler]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(classHandler.handle).toHaveBeenCalledWith(mockAbility);
    });

    it('returns true when all function-based policy handlers return true', async () => {
      const user = makeUser();
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler1 = jest.fn().mockReturnValue(true);
      const handler2 = jest.fn().mockReturnValue(true);

      const context = makeContext([handler1, handler2], { userId: user.id });
      reflector.get.mockReturnValue([handler1, handler2]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(handler1).toHaveBeenCalledWith(mockAbility);
      expect(handler2).toHaveBeenCalledWith(mockAbility);
    });

    it('returns true when a class-based policy handler returns true', async () => {
      const user = makeUser();
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const classHandler: IPolicyHandler = { handle: jest.fn().mockReturnValue(true) };

      const context = makeContext([classHandler], { userId: user.id });
      reflector.get.mockReturnValue([classHandler]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(classHandler.handle).toHaveBeenCalledWith(mockAbility);
    });

    it('throws ForbiddenException when at least one handler in a mixed list returns false', async () => {
      const user = makeUser();
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const passingHandler = jest.fn().mockReturnValue(true);
      const failingHandler = jest.fn().mockReturnValue(false);

      const context = makeContext([passingHandler, failingHandler], { userId: user.id });
      reflector.get.mockReturnValue([passingHandler, failingHandler]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('calls caslAbilityFactory.createForUser with the resolved user', async () => {
      const user = makeUser();
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler = jest.fn().mockReturnValue(true);

      const context = makeContext([handler], { userId: user.id });
      reflector.get.mockReturnValue([handler]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      await guard.canActivate(context);

      expect(caslAbilityFactory.createForUser).toHaveBeenCalledWith(user);
    });

    it('looks up user by id from request', async () => {
      const user = makeUser({ id: 'specific-user-id' });
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler = jest.fn().mockReturnValue(true);

      const context = makeContext([handler], { userId: 'specific-user-id' });
      reflector.get.mockReturnValue([handler]);
      userRepo.findOneBy.mockResolvedValue(user);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      await guard.canActivate(context);

      expect(userRepo.findOneBy).toHaveBeenCalledWith({ id: 'specific-user-id' });
    });
  });
});
