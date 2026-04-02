import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TwoFactorGateService } from './two-factor-gate.service';
import { Verification } from '../entities/verification.entity';
import { mockDataSource, mockRepository } from '../../../../mocks/db.mock';
import { UserRole } from '../../user/user-role.enum';
import {
  TFA_PENDING_EXPIRES_MS,
  TRUST_DEVICE_EXPIRES_MS,
  TRUST_DEVICE_TYPE,
} from '../auth.constants';

jest.mock('../crypto.util', () => ({
  hashToken: jest.fn().mockReturnValue('hashed-token'),
  signHmac: jest.fn().mockReturnValue('valid-sig'),
  verifyHmac: jest.fn().mockReturnValue(true),
}));

import { hashToken, signHmac, verifyHmac } from '../crypto.util';

const NOW = 2_000_000_000_000;

const makeVerification = (
  overrides: Partial<Verification> = {},
): Verification =>
  ({
    id: 'ver-uuid',
    identifier: `${TRUST_DEVICE_TYPE}:hashed-token`,
    value: 'user-uuid',
    expiresAt: new Date(NOW + TRUST_DEVICE_EXPIRES_MS),
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  }) as Verification;

describe('TwoFactorGateService', () => {
  let service: TwoFactorGateService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let configService: { getOrThrow: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    dataSource = mockDataSource();
    configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };
    jwtService = { signAsync: jest.fn().mockResolvedValue('pending-jwt') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorGateService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(TwoFactorGateService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── createPendingToken ──────────────────────────────────────────────────────

  describe('createPendingToken', () => {
    it('signs JWT with sub, role and type=2fa_pending payload', async () => {
      await service.createPendingToken('user-uuid', UserRole.Member);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-uuid', role: UserRole.Member, type: '2fa_pending' },
        expect.objectContaining({ expiresIn: TFA_PENDING_EXPIRES_MS / 1000 }),
      );
    });

    it('signs JWT with TFA_PENDING_EXPIRES_MS / 1000 as expiresIn', async () => {
      await service.createPendingToken('user-uuid', UserRole.Member);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: TFA_PENDING_EXPIRES_MS / 1000 }),
      );
    });

    it('returns the signed JWT', async () => {
      const result = await service.createPendingToken(
        'user-uuid',
        UserRole.Member,
      );

      expect(result).toBe('pending-jwt');
    });
  });

  // ─── checkTrustDevice ────────────────────────────────────────────────────────

  describe('checkTrustDevice', () => {
    it('returns false when cookie does not have 3 parts', async () => {
      const result = await service.checkTrustDevice(
        'user-uuid.only-two-parts',
        'user-uuid',
      );

      expect(result).toBe(false);
    });

    it('returns false when cookie userId does not match provided userId', async () => {
      const result = await service.checkTrustDevice(
        'other-user.some-token.some-sig',
        'user-uuid',
      );

      expect(result).toBe(false);
    });

    it('returns false when HMAC verification fails', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(false);

      const result = await service.checkTrustDevice(
        'user-uuid.some-token.bad-sig',
        'user-uuid',
      );

      expect(result).toBe(false);
    });

    it('returns false when no verification record found in DB', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(true);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.checkTrustDevice(
        'user-uuid.some-token.valid-sig',
        'user-uuid',
      );

      expect(result).toBe(false);
    });

    it('returns false when verification record value does not match userId', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(true);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(
        makeVerification({ value: 'different-user' }),
      );
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.checkTrustDevice(
        'user-uuid.some-token.valid-sig',
        'user-uuid',
      );

      expect(result).toBe(false);
    });

    it('returns false when verification record has expired', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(true);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(
        makeVerification({ expiresAt: new Date(NOW - 1) }),
      );
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.checkTrustDevice(
        'user-uuid.some-token.valid-sig',
        'user-uuid',
      );

      expect(result).toBe(false);
    });

    it('returns true when all checks pass and record is valid and not expired', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(true);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(
        makeVerification({
          value: 'user-uuid',
          expiresAt: new Date(NOW + 1000),
        }),
      );
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.checkTrustDevice(
        'user-uuid.some-token.valid-sig',
        'user-uuid',
      );

      expect(result).toBe(true);
    });

    it('returns true when record expiresAt is exactly equal to current time (boundary)', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(true);

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(
        makeVerification({ value: 'user-uuid', expiresAt: new Date(NOW) }),
      );
      dataSource.getRepository.mockReturnValue(verRepo);

      const result = await service.checkTrustDevice(
        'user-uuid.some-token.valid-sig',
        'user-uuid',
      );

      expect(result).toBe(true);
    });

    it('queries DB with TRUST_DEVICE_TYPE prefixed token hash', async () => {
      (verifyHmac as jest.Mock).mockReturnValue(true);
      (hashToken as jest.Mock).mockReturnValue('computed-hash');

      const verRepo = mockRepository();
      verRepo.findOne.mockResolvedValue(null);
      dataSource.getRepository.mockReturnValue(verRepo);

      await service.checkTrustDevice(
        'user-uuid.my-token.valid-sig',
        'user-uuid',
      );

      expect(verRepo.findOne).toHaveBeenCalledWith({
        where: { identifier: `${TRUST_DEVICE_TYPE}:computed-hash` },
      });
    });
  });

  // ─── rotateTrustDevice ───────────────────────────────────────────────────────

  describe('rotateTrustDevice', () => {
    it('deletes old token record and returns new cookie value', async () => {
      (hashToken as jest.Mock).mockReturnValue('old-hash');

      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      configService.getOrThrow.mockReturnValue('test-secret');
      (signHmac as jest.Mock).mockReturnValue('new-sig');

      const result = await service.rotateTrustDevice(
        'user-uuid.old-token.old-sig',
        'user-uuid',
      );

      expect(verRepo.delete).toHaveBeenCalledWith({
        identifier: `${TRUST_DEVICE_TYPE}:old-hash`,
      });
      expect(typeof result).toBe('string');
      expect(result.split('.')).toHaveLength(3);
    });

    it('does not attempt to delete when cookie has wrong format', async () => {
      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      await service.rotateTrustDevice('malformed-cookie', 'user-uuid');

      // delete is still called for the new cookie save, but NOT for the old hash removal
      expect(verRepo.delete).not.toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: expect.stringContaining(TRUST_DEVICE_TYPE),
        }),
      );
    });

    it('returns a new cookie in userId.token.sig format', async () => {
      const verRepo = mockRepository();
      verRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      (signHmac as jest.Mock).mockReturnValue('new-sig');

      const result = await service.rotateTrustDevice(
        'user-uuid.old-token.old-sig',
        'user-uuid',
      );

      const parts = result.split('.');
      expect(parts[0]).toBe('user-uuid');
      expect(parts[2]).toBe('new-sig');
    });
  });

  // ─── createTrustDeviceCookieValue ────────────────────────────────────────────

  describe('createTrustDeviceCookieValue', () => {
    it('saves a verification record with TRUST_DEVICE_TYPE prefix and userId as value', async () => {
      (hashToken as jest.Mock).mockReturnValue('token-hash');

      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      await service.createTrustDeviceCookieValue('user-uuid');

      expect(verRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: `${TRUST_DEVICE_TYPE}:token-hash`,
          value: 'user-uuid',
        }),
      );
      expect(verRepo.save).toHaveBeenCalledTimes(1);
    });

    it('saves verification record with correct expiry based on TRUST_DEVICE_EXPIRES_MS', async () => {
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      await service.createTrustDeviceCookieValue('user-uuid');

      expect(verRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(NOW + TRUST_DEVICE_EXPIRES_MS),
        }),
      );
    });

    it('returns cookie in userId.token.sig format', async () => {
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      (signHmac as jest.Mock).mockReturnValue('computed-sig');

      const result = await service.createTrustDeviceCookieValue('user-uuid');

      const parts = result.split('.');
      expect(parts[0]).toBe('user-uuid');
      expect(parts).toHaveLength(3);
      expect(parts[2]).toBe('computed-sig');
    });

    it('signs HMAC over userId.token with the access secret', async () => {
      const verRepo = mockRepository();
      verRepo.create.mockReturnValue(makeVerification());
      verRepo.save.mockResolvedValue(makeVerification());
      dataSource.getRepository.mockReturnValue(verRepo);

      configService.getOrThrow.mockReturnValue('my-access-secret');

      await service.createTrustDeviceCookieValue('user-uuid');

      expect(signHmac).toHaveBeenCalledWith(
        'my-access-secret',
        expect.stringMatching(/^user-uuid\./),
      );
    });
  });
});
