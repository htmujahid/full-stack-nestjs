import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
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

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(PermissionsGuard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('returns true when no permissions are required', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('returns true when an empty array of permissions is required', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('throws ForbiddenException when req.user is missing', () => {
      reflector.getAllAndOverride.mockReturnValue(['project:read']);
      const context = makeContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('returns true when user is Admin (bypasses permission check)', () => {
      reflector.getAllAndOverride.mockReturnValue(['project:delete', 'project:update']);
      const context = makeContext({ userId: 'u1', role: UserRole.Admin });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('returns true when Member has all required permissions', () => {
      reflector.getAllAndOverride.mockReturnValue(['project:read', 'project:create']);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('throws ForbiddenException when Member lacks a required permission', () => {
      reflector.getAllAndOverride.mockReturnValue(['project:read', 'user:delete']);
      const context = makeContext({ userId: 'u1', role: UserRole.Member });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
