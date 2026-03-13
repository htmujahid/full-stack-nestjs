import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtRefreshStrategy, type JwtRefreshPayload } from './jwt-refresh.strategy';
import { RefreshSession } from '../entities/refresh-session.entity';
import { REFRESH_TOKEN_COOKIE } from '../auth.constants';
import { mockRepository } from '../../../../mocks/db.mock';
import { UserRole } from '../../user/user-role.enum';

const makePayload = (overrides: Partial<JwtRefreshPayload> = {}): JwtRefreshPayload => ({
  sub: 'user-uuid',
  role: UserRole.Member,
  sid: 'session-uuid',
  fid: 'family-uuid',
  ...overrides,
});

const makeSession = (overrides: Partial<RefreshSession> = {}): RefreshSession =>
  ({
    id: 'session-uuid',
    userId: 'user-uuid',
    familyId: 'family-uuid',
    hashedToken: 'hashed',
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as RefreshSession;

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;
  let repo: ReturnType<typeof mockRepository>;
  let dataSource: jest.Mocked<Pick<DataSource, 'getRepository'>>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    repo = mockRepository();
    dataSource = {
      getRepository: jest.fn().mockReturnValue(repo),
    } as unknown as jest.Mocked<Pick<DataSource, 'getRepository'>>;

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
    } as unknown as ConfigService;

    strategy = new JwtRefreshStrategy(configService, dataSource as unknown as DataSource);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('returns { userId, role, sessionId, familyId, rawRefreshToken } on valid session', async () => {
      const session = makeSession();
      repo.findOne.mockResolvedValue(session);

      const req = { cookies: { [REFRESH_TOKEN_COOKIE]: 'raw-token' }, headers: {} } as never;
      const result = await strategy.validate(req, makePayload());

      expect(result).toEqual({
        userId: 'user-uuid',
        role: UserRole.Member,
        sessionId: 'session-uuid',
        familyId: 'family-uuid',
        rawRefreshToken: 'raw-token',
      });
    });

    it('gets token from cookie when present', async () => {
      const session = makeSession();
      repo.findOne.mockResolvedValue(session);

      const req = {
        cookies: { [REFRESH_TOKEN_COOKIE]: 'cookie-token' },
        headers: { authorization: 'Bearer header-token' },
      } as never;
      const result = await strategy.validate(req, makePayload());

      expect(result.rawRefreshToken).toBe('cookie-token');
    });

    it('gets token from Authorization header when cookie is absent', async () => {
      const session = makeSession();
      repo.findOne.mockResolvedValue(session);

      const req = {
        cookies: {},
        headers: { authorization: 'Bearer header-token' },
      } as never;
      const result = await strategy.validate(req, makePayload());

      expect(result.rawRefreshToken).toBe('header-token');
    });

    it('throws UnauthorizedException when no token found', async () => {
      const req = { cookies: {}, headers: {} } as never;

      await expect(strategy.validate(req, makePayload())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deletes entire family and throws "Refresh token reuse detected" when session not found', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const req = { cookies: { [REFRESH_TOKEN_COOKIE]: 'raw-token' }, headers: {} } as never;
      const payload = makePayload({ sub: 'user-uuid', fid: 'family-uuid' });

      await expect(strategy.validate(req, payload)).rejects.toThrow(
        'Refresh token reuse detected',
      );
      expect(repo.delete).toHaveBeenCalledWith({
        userId: 'user-uuid',
        familyId: 'family-uuid',
      });
    });

    it('deletes session and throws "Refresh token expired" when session is expired', async () => {
      const expiredSession = makeSession({
        expiresAt: new Date(Date.now() - 1000),
      });
      repo.findOne.mockResolvedValue(expiredSession);
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const req = { cookies: { [REFRESH_TOKEN_COOKIE]: 'raw-token' }, headers: {} } as never;

      await expect(strategy.validate(req, makePayload())).rejects.toThrow(
        'Refresh token expired',
      );
      expect(repo.delete).toHaveBeenCalledWith(expiredSession.id);
    });

    it('queries the session by id, userId, and familyId from payload', async () => {
      const session = makeSession();
      repo.findOne.mockResolvedValue(session);

      const req = { cookies: { [REFRESH_TOKEN_COOKIE]: 'raw-token' }, headers: {} } as never;
      await strategy.validate(req, makePayload());

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'session-uuid', userId: 'user-uuid', familyId: 'family-uuid' },
      });
    });
  });
});
