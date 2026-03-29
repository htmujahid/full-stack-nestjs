import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAccessGuard } from './jwt-access.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const makeContext = (): ExecutionContext =>
  ({
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn(),
  }) as unknown as ExecutionContext;

describe('JwtAccessGuard', () => {
  let guard: JwtAccessGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAccessGuard(reflector);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('returns true immediately when route is marked public', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const ctx = makeContext();

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
    });

    it('calls super.canActivate when route is not public', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const ctx = makeContext();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAccessGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
      superCanActivate.mockRestore();
    });

    it('calls super.canActivate when reflector returns undefined', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = makeContext();
      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAccessGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
      superCanActivate.mockRestore();
    });
  });

  describe('handleRequest', () => {
    it('returns user when no error and user is truthy', () => {
      const user = { userId: 'abc', authMethod: 'password' };

      const result = guard.handleRequest(null, user);

      expect(result).toBe(user);
    });

    it('throws UnauthorizedException when user is null', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('re-throws provided error when err is set', () => {
      const err = new Error('jwt expired');

      expect(() => guard.handleRequest(err, null)).toThrow(err);
    });

    it('re-throws error even when user is truthy', () => {
      const err = new Error('malformed token');
      const user = { userId: 'abc' };

      expect(() => guard.handleRequest(err, user)).toThrow(err);
    });
  });
});
