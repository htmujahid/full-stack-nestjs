import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy } from './jwt-access.strategy';
import type { JwtAccessPayload } from '../types';
import { UserRole } from '../../user/user-role.enum';

const makeStrategy = (): JwtAccessStrategy => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-access-secret'),
  } as unknown as ConfigService;
  return new JwtAccessStrategy(configService);
};

describe('JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;

  beforeEach(() => {
    strategy = makeStrategy();
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    it('maps { sub, role, auth_method } to { userId, role, authMethod }', () => {
      const payload: JwtAccessPayload = {
        sub: 'user-uuid',
        role: UserRole.Member,
        auth_method: 'password',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-uuid',
        role: UserRole.Member,
        authMethod: 'password',
      });
    });

    it('passes through "google" authMethod correctly', () => {
      const payload: JwtAccessPayload = {
        sub: 'user-uuid',
        role: UserRole.Member,
        auth_method: 'google',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-uuid',
        role: UserRole.Member,
        authMethod: 'google',
      });
    });

    it('passes through "refresh" authMethod correctly', () => {
      const payload: JwtAccessPayload = {
        sub: 'user-uuid',
        role: UserRole.Member,
        auth_method: 'refresh',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-uuid',
        role: UserRole.Member,
        authMethod: 'refresh',
      });
    });

    it('returns userId from sub field', () => {
      const payload: JwtAccessPayload = {
        sub: 'specific-user-id',
        role: UserRole.Member,
        auth_method: 'password',
      };

      const result = strategy.validate(payload);

      expect(result.userId).toBe('specific-user-id');
    });

    it('preserves Admin role from payload', () => {
      const payload: JwtAccessPayload = {
        sub: 'admin-uuid',
        role: UserRole.Admin,
        auth_method: 'password',
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe(UserRole.Admin);
    });
  });
});
