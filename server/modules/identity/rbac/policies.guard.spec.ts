import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from './policies.guard';
import { CaslAbilityFactory, AppAbility } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, IPolicyHandler } from './check-policies.decorator';
import { UserRole } from '../user/user-role.enum';

const makeContext = (
  handlers: unknown[] | undefined,
  user: { userId: string; role: UserRole } | undefined,
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

  beforeEach(async () => {
    reflector = { get: jest.fn() };
    caslAbilityFactory = { createForUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: CaslAbilityFactory, useValue: caslAbilityFactory },
      ],
    }).compile();

    guard = module.get(PoliciesGuard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('returns true when no policy handlers are registered', () => {
      const context = makeContext(undefined, undefined);
      reflector.get.mockReturnValue(undefined);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('returns true when an empty array of handlers is registered', () => {
      const context = makeContext([], undefined);
      reflector.get.mockReturnValue([]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('throws ForbiddenException when req.user is missing', () => {
      const context = makeContext([jest.fn()], undefined);
      reflector.get.mockReturnValue([jest.fn()]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a function-based policy handler returns false', () => {
      const user = { userId: 'user-1', role: UserRole.Member };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler = jest.fn().mockReturnValue(false);

      const context = makeContext([handler], user);
      reflector.get.mockReturnValue([handler]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(handler).toHaveBeenCalledWith(mockAbility);
    });

    it('throws ForbiddenException when a class-based policy handler returns false', () => {
      const user = { userId: 'user-1', role: UserRole.Member };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;

      const classHandler: IPolicyHandler = { handle: jest.fn().mockReturnValue(false) };

      const context = makeContext([classHandler], user);
      reflector.get.mockReturnValue([classHandler]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(classHandler.handle).toHaveBeenCalledWith(mockAbility);
    });

    it('returns true when all function-based policy handlers return true', () => {
      const user = { userId: 'user-1', role: UserRole.Member };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler1 = jest.fn().mockReturnValue(true);
      const handler2 = jest.fn().mockReturnValue(true);

      const context = makeContext([handler1, handler2], user);
      reflector.get.mockReturnValue([handler1, handler2]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(handler1).toHaveBeenCalledWith(mockAbility);
      expect(handler2).toHaveBeenCalledWith(mockAbility);
    });

    it('returns true when a class-based policy handler returns true', () => {
      const user = { userId: 'user-1', role: UserRole.Member };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const classHandler: IPolicyHandler = { handle: jest.fn().mockReturnValue(true) };

      const context = makeContext([classHandler], user);
      reflector.get.mockReturnValue([classHandler]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(classHandler.handle).toHaveBeenCalledWith(mockAbility);
    });

    it('throws ForbiddenException when at least one handler in a mixed list returns false', () => {
      const user = { userId: 'user-1', role: UserRole.Member };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const passingHandler = jest.fn().mockReturnValue(true);
      const failingHandler = jest.fn().mockReturnValue(false);

      const context = makeContext([passingHandler, failingHandler], user);
      reflector.get.mockReturnValue([passingHandler, failingHandler]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('calls caslAbilityFactory.createForUser with id and role from request.user', () => {
      const user = { userId: 'user-1', role: UserRole.Member };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler = jest.fn().mockReturnValue(true);

      const context = makeContext([handler], user);
      reflector.get.mockReturnValue([handler]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      guard.canActivate(context);

      expect(caslAbilityFactory.createForUser).toHaveBeenCalledWith({
        id: 'user-1',
        role: UserRole.Member,
      });
    });

    it('reads userId and role from request.user', () => {
      const user = { userId: 'specific-user-id', role: UserRole.Admin };
      const mockAbility = { can: jest.fn() } as unknown as AppAbility;
      const handler = jest.fn().mockReturnValue(true);

      const context = makeContext([handler], user);
      reflector.get.mockReturnValue([handler]);
      caslAbilityFactory.createForUser.mockReturnValue(mockAbility);

      guard.canActivate(context);

      expect(caslAbilityFactory.createForUser).toHaveBeenCalledWith({
        id: 'specific-user-id',
        role: UserRole.Admin,
      });
    });
  });
});
