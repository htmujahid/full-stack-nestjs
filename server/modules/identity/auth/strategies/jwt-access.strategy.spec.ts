import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy, type JwtAccessPayload } from './jwt-access.strategy';

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
    it('maps { sub, auth_method } to { userId, authMethod }', () => {
      const payload: JwtAccessPayload = { sub: 'user-uuid', auth_method: 'password' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ userId: 'user-uuid', authMethod: 'password' });
    });

    it('passes through "google" authMethod correctly', () => {
      const payload: JwtAccessPayload = { sub: 'user-uuid', auth_method: 'google' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ userId: 'user-uuid', authMethod: 'google' });
    });

    it('passes through "refresh" authMethod correctly', () => {
      const payload: JwtAccessPayload = { sub: 'user-uuid', auth_method: 'refresh' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ userId: 'user-uuid', authMethod: 'refresh' });
    });

    it('returns userId from sub field', () => {
      const payload: JwtAccessPayload = { sub: 'specific-user-id', auth_method: 'password' };

      const result = strategy.validate(payload);

      expect(result.userId).toBe('specific-user-id');
    });
  });
});
