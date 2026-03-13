import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TwoFactorPendingGuard } from './two-factor-pending.guard';
import { TFA_PENDING_COOKIE } from '../../auth/auth.constants';

const makeContext = (
  cookies: Record<string, string> = {},
): { ctx: ExecutionContext; req: Record<string, unknown> } => {
  const req: Record<string, unknown> = { cookies };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
};

describe('TwoFactorPendingGuard', () => {
  let guard: TwoFactorPendingGuard;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as unknown as jest.Mocked<JwtService>;
    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as jest.Mocked<ConfigService>;
    guard = new TwoFactorPendingGuard(jwtService, configService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('canActivate', () => {
    it('throws UnauthorizedException when no 2fa_pending cookie', async () => {
      const { ctx } = makeContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('No pending 2FA session');
    });

    it('throws UnauthorizedException when JWT verification fails', async () => {
      const { ctx } = makeContext({ [TFA_PENDING_COOKIE]: 'bad-token' });
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid or expired 2FA session');
    });

    it('throws UnauthorizedException when payload.type is not "2fa_pending"', async () => {
      const { ctx } = makeContext({ [TFA_PENDING_COOKIE]: 'valid-token' });
      jwtService.verifyAsync.mockResolvedValue({ type: 'access', sub: 'user-uuid', role: 'member' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid 2FA session');
    });

    it('throws UnauthorizedException when payload.sub is missing', async () => {
      const { ctx } = makeContext({ [TFA_PENDING_COOKIE]: 'valid-token' });
      jwtService.verifyAsync.mockResolvedValue({ type: '2fa_pending', sub: undefined, role: 'member' });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid 2FA session');
    });

    it('throws UnauthorizedException when payload.role is missing', async () => {
      const { ctx } = makeContext({ [TFA_PENDING_COOKIE]: 'valid-token' });
      jwtService.verifyAsync.mockResolvedValue({ type: '2fa_pending', sub: 'user-uuid', role: undefined });

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid 2FA session');
    });

    it('sets req.user = { userId, role } and returns true on valid token', async () => {
      const { ctx, req } = makeContext({ [TFA_PENDING_COOKIE]: 'valid-token' });
      jwtService.verifyAsync.mockResolvedValue({ type: '2fa_pending', sub: 'user-uuid', role: 'member' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(req.user).toEqual({ userId: 'user-uuid', role: 'member' });
    });

    it('uses auth.accessSecret from configService', async () => {
      const { ctx } = makeContext({ [TFA_PENDING_COOKIE]: 'valid-token' });
      jwtService.verifyAsync.mockResolvedValue({ type: '2fa_pending', sub: 'user-uuid', role: 'member' });

      await guard.canActivate(ctx);

      expect(configService.getOrThrow).toHaveBeenCalledWith('auth.accessSecret');
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
    });
  });
});
