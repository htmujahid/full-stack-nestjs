import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../user/user-role.enum';

const makeContext = (
  user: { userId: string; role: UserRole } | undefined,
): ExecutionContext => {
  const getRequest = jest.fn().mockReturnValue({ user });
  const switchToHttp = jest.fn().mockReturnValue({ getRequest });
  const getHandler = jest.fn();
  const getClass = jest.fn();
  return { switchToHttp, getHandler, getClass } as unknown as ExecutionContext;
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(RolesGuard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('returns true when no roles are registered', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('returns true when an empty array of roles is registered', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('throws ForbiddenException when req.user is missing', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.Member]);
      const context = makeContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user role is not in the list', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.Admin]);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('returns true when user role is in the list', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.Admin, UserRole.Member]);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('returns true when user is Admin and Admin is in the list', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.Admin, UserRole.Member]);
      const context = makeContext({ userId: 'u1', role: UserRole.Admin });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
