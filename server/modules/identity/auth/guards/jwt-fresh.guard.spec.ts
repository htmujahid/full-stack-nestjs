import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtFreshGuard } from './jwt-fresh.guard';

describe('JwtFreshGuard', () => {
  let guard: JwtFreshGuard;

  beforeEach(() => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    guard = new JwtFreshGuard(reflector);
  });

  afterEach(() => jest.clearAllMocks());

  describe('handleRequest', () => {
    it('returns user when authMethod is "password"', () => {
      const user = { userId: 'abc', authMethod: 'password' };

      const result = guard.handleRequest(null, user);

      expect(result).toBe(user);
    });

    it('returns user when authMethod is "google"', () => {
      const user = { userId: 'abc', authMethod: 'google' };

      const result = guard.handleRequest(null, user);

      expect(result).toBe(user);
    });

    it('throws ForbiddenException when authMethod is "refresh"', () => {
      const user = { userId: 'abc', authMethod: 'refresh' };

      expect(() => guard.handleRequest(null, user)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException with message "Re-authentication required"', () => {
      const user = { userId: 'abc', authMethod: 'refresh' };

      expect(() => guard.handleRequest(null, user)).toThrow('Re-authentication required');
    });

    it('throws UnauthorizedException when user is null (inherited from JwtAccessGuard)', () => {
      expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
    });

    it('re-throws error when err is set (inherited from JwtAccessGuard)', () => {
      const err = new Error('jwt malformed');
      const user = { userId: 'abc', authMethod: 'password' };

      expect(() => guard.handleRequest(err, user)).toThrow(err);
    });
  });
});
