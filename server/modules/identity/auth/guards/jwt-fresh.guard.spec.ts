import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtFreshGuard } from './jwt-fresh.guard';

describe('JwtFreshGuard', () => {
  let guard: JwtFreshGuard;

  beforeEach(() => {
    guard = new JwtFreshGuard();
  });

  const createContext = (user: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  describe('canActivate', () => {
    it('returns true when authMethod is "password"', () => {
      const user = { userId: 'abc', authMethod: 'password' };
      expect(guard.canActivate(createContext(user))).toBe(true);
    });

    it('returns true when authMethod is "google"', () => {
      const user = { userId: 'abc', authMethod: 'google' };
      expect(guard.canActivate(createContext(user))).toBe(true);
    });

    it('throws ForbiddenException when authMethod is "refresh"', () => {
      const user = { userId: 'abc', authMethod: 'refresh' };
      expect(() => guard.canActivate(createContext(user))).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with message "Re-authentication required"', () => {
      const user = { userId: 'abc', authMethod: 'refresh' };
      expect(() => guard.canActivate(createContext(user))).toThrow('Re-authentication required');
    });

    it('throws UnauthorizedException when user is null', () => {
      expect(() => guard.canActivate(createContext(undefined))).toThrow(UnauthorizedException);
    });
  });
});
