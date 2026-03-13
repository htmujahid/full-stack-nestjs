import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { RefreshSession } from '../entities/refresh-session.entity';
import { mockDataSource, mockRepository } from '../../../../mocks/db.mock';
import { UserRole } from '../../user/user-role.enum';
import {
  ACCESS_EXPIRES_MS,
  REFRESH_EXPIRES_MS,
  REFRESH_REMEMBER_ME_EXPIRES_MS,
} from '../auth.constants';

jest.mock('../crypto.util', () => ({
  hashToken: jest.fn().mockReturnValue('hashed-token'),
  verifyToken: jest.fn().mockReturnValue(true),
}));

import { hashToken, verifyToken } from '../crypto.util';

const NOW = 2_000_000_000_000;

const makeSession = (overrides: Partial<RefreshSession> = {}): RefreshSession =>
  ({
    id: 'session-uuid',
    userId: 'user-uuid',
    familyId: 'family-uuid',
    hashedToken: 'hashed-token',
    expiresAt: new Date(NOW + REFRESH_EXPIRES_MS),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as RefreshSession;

describe('AuthService', () => {
  let service: AuthService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let configService: { getOrThrow: jest.Mock };
  let jwtService: { signAsync: jest.Mock; decode: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
      decode: jest.fn().mockReturnValue({ sid: 'session-uuid' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── createAuthSession ───────────────────────────────────────────────────────

  describe('createAuthSession', () => {
    it('signs access and refresh tokens and returns a token pair', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      const result = await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        false,
        { ip: '127.0.0.1', userAgent: 'jest' },
        'password',
      );

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toBe('signed-jwt');
      expect(result.refreshExpiresAt).toEqual(new Date(NOW + REFRESH_EXPIRES_MS));
    });

    it('signs access token with sub and auth_method payload', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      configService.getOrThrow
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        false,
        { ip: null, userAgent: null },
        'password',
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-uuid', role: UserRole.Member, auth_method: 'password' },
        expect.objectContaining({ secret: 'access-secret' }),
      );
    });

    it('signs refresh token with sub, sid and fid payload', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      configService.getOrThrow
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        false,
        { ip: null, userAgent: null },
        'password',
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-uuid', sid: expect.any(String), fid: expect.any(String) }),
        expect.objectContaining({ secret: 'refresh-secret' }),
      );
    });

    it('uses REFRESH_REMEMBER_ME_EXPIRES_MS when rememberMe is true', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      const result = await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        true,
        { ip: null, userAgent: null },
        'password',
      );

      expect(result.refreshExpiresAt).toEqual(
        new Date(NOW + REFRESH_REMEMBER_ME_EXPIRES_MS),
      );
    });

    it('uses REFRESH_EXPIRES_MS when rememberMe is false', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      const result = await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        false,
        { ip: null, userAgent: null },
        'password',
      );

      expect(result.refreshExpiresAt).toEqual(new Date(NOW + REFRESH_EXPIRES_MS));
    });

    it('saves the refresh session with ip and userAgent from context', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        false,
        { ip: '10.0.0.1', userAgent: 'Mozilla/5.0' },
        'password',
      );

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
      expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    });

    it('hashes the refresh token before persisting to DB', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await service.createAuthSession(
        'user-uuid',
        UserRole.Member,
        false,
        { ip: null, userAgent: null },
        'password',
      );

      expect(hashToken).toHaveBeenCalledWith('signed-jwt');
      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ hashedToken: 'hashed-token' }),
      );
    });
  });

  // ─── refreshTokens ───────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('rotates session and returns new token pair on valid refresh', async () => {
      const session = makeSession();
      const sessionRepo = mockRepository();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);
      dataSource.getRepository.mockReturnValue(sessionRepo);

      (verifyToken as jest.Mock).mockReturnValue(true);

      const result = await service.refreshTokens(
        'user-uuid',
        UserRole.Member,
        'session-uuid',
        'family-uuid',
        'raw-refresh-token',
        { ip: null, userAgent: null },
      );

      expect(sessionRepo.delete).toHaveBeenCalledWith(session.id);
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toBe('signed-jwt');
    });

    it('deletes entire family and throws UnauthorizedException when session not found', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.findOne.mockResolvedValue(null);
      sessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await expect(
        service.refreshTokens(
          'user-uuid',
          UserRole.Member,
          'session-uuid',
          'family-uuid',
          'raw-refresh-token',
          { ip: null, userAgent: null },
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionRepo.delete).toHaveBeenCalledWith({
        userId: 'user-uuid',
        familyId: 'family-uuid',
      });
    });

    it('throws UnauthorizedException when token hash does not match', async () => {
      const session = makeSession();
      const sessionRepo = mockRepository();
      sessionRepo.findOne.mockResolvedValue(session);
      dataSource.getRepository.mockReturnValue(sessionRepo);

      (verifyToken as jest.Mock).mockReturnValue(false);

      await expect(
        service.refreshTokens(
          'user-uuid',
          UserRole.Member,
          'session-uuid',
          'family-uuid',
          'tampered-token',
          { ip: null, userAgent: null },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues new tokens signed with auth_method=refresh', async () => {
      const session = makeSession();
      const sessionRepo = mockRepository();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);
      dataSource.getRepository.mockReturnValue(sessionRepo);

      (verifyToken as jest.Mock).mockReturnValue(true);

      configService.getOrThrow
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret')
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      await service.refreshTokens(
        'user-uuid',
        UserRole.Member,
        'session-uuid',
        'family-uuid',
        'raw-token',
        { ip: null, userAgent: null },
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-uuid', role: UserRole.Member, auth_method: 'refresh' },
        expect.objectContaining({ secret: 'access-secret' }),
      );
    });

    it('queries session with correct sessionId, userId and familyId', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.findOne.mockResolvedValue(null);
      sessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await expect(
        service.refreshTokens(
          'user-uuid',
          UserRole.Member,
          'session-uuid',
          'family-uuid',
          'raw-token',
          { ip: null, userAgent: null },
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-uuid', userId: 'user-uuid', familyId: 'family-uuid' },
        }),
      );
    });
  });

  // ─── signOut ─────────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('deletes session by id and userId', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await service.signOut('user-uuid', 'session-uuid');

      expect(sessionRepo.delete).toHaveBeenCalledWith({
        id: 'session-uuid',
        userId: 'user-uuid',
      });
    });

    it('calls getRepository with RefreshSession entity', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await service.signOut('user-uuid', 'session-uuid');

      expect(dataSource.getRepository).toHaveBeenCalledWith(RefreshSession);
    });

    it('does not throw when no session is found to delete', async () => {
      const sessionRepo = mockRepository();
      sessionRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      dataSource.getRepository.mockReturnValue(sessionRepo);

      await expect(service.signOut('user-uuid', 'nonexistent')).resolves.toBeUndefined();
    });
  });
});
