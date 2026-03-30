jest.mock('../server/api/identity/2fa/two-factor.service', () => ({
  TwoFactorService: class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { TwoFactorController } from '../server/api/identity/2fa/two-factor.controller';
import { TwoFactorService } from '../server/api/identity/2fa/two-factor.service';
import { TwoFactorGateService } from '../server/api/identity/auth/services/two-factor-gate.service';
import { JwtAccessGuard } from '../server/api/identity/auth/guards/jwt-access.guard';
import { JwtFreshGuard } from '../server/api/identity/auth/guards/jwt-fresh.guard';
import { TwoFactorPendingGuard } from '../server/api/identity/2fa/guards/two-factor-pending.guard';
import { UserRole } from '../server/api/identity/user/user-role.enum';

const throttlerGuard = { canActivate: () => true };

const setUserGuard = (user: object) => ({
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = user;
    return true;
  },
});

const userId = 'test-user-id';
const pendingUser = { userId, role: UserRole.Member };

describe('Two-Factor (e2e)', () => {
  let app: INestApplication;
  let twoFactorService: ReturnType<typeof mockTwoFactorService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  function mockTwoFactorService() {
    return {
      enable: jest.fn(),
      verifyEnableTotp: jest.fn(),
      disable: jest.fn(),
      getTotpUri: jest.fn(),
      verifyTotp: jest.fn(),
      sendOtp: jest.fn(),
      verifyOtp: jest.fn(),
      verifyBackupCode: jest.fn(),
      generateBackupCodes: jest.fn(),
    };
  }
  function mockTwoFactorGateService() {
    return {
      checkTrustDevice: jest.fn(),
      createPendingToken: jest.fn(),
      rotateTrustDevice: jest.fn(),
    };
  }

  beforeAll(async () => {
    twoFactorService = mockTwoFactorService();
    twoFactorGate = mockTwoFactorGateService();

    @Module({
      controllers: [TwoFactorController],
      providers: [
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/two-factor', module: TestModule }])],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(throttlerGuard)
      .overrideGuard(JwtAccessGuard)
      .useValue(setUserGuard({ userId }))
      .overrideGuard(JwtFreshGuard)
      .useValue(setUserGuard({ userId }))
      .overrideGuard(TwoFactorPendingGuard)
      .useValue(setUserGuard(pendingUser))
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── POST /api/two-factor/enable ───────────────────────────────────────────

  describe('POST /api/two-factor/enable', () => {
    it('returns 200 with totpUri and backupCodes', async () => {
      twoFactorService.enable.mockResolvedValue({
        totpURI: 'otpauth://totp/...',
        backupCodes: ['xxxxx-yyyyy'],
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/enable')
        .send({})
        .expect(200);

      expect(body.totpURI).toBeDefined();
      expect(body.backupCodes).toBeDefined();
    });
  });

  // ─── POST /api/two-factor/enable/verify ────────────────────────────────────

  describe('POST /api/two-factor/enable/verify', () => {
    it('returns 200 with ok', async () => {
      twoFactorService.verifyEnableTotp.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/enable/verify')
        .send({ code: '123456' })
        .expect(200);

      expect(body.ok).toBe(true);
    });

    it('returns 400 when code invalid length', async () => {
      await request(app.getHttpServer())
        .post('/api/two-factor/enable/verify')
        .send({ code: '12' })
        .expect(400);
    });
  });

  // ─── POST /api/two-factor/disable ────────────────────────────────────────────

  describe('POST /api/two-factor/disable', () => {
    it('returns 200 with ok', async () => {
      twoFactorService.disable.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/disable')
        .send({})
        .expect(200);

      expect(body.ok).toBe(true);
    });
  });

  // ─── POST /api/two-factor/get-totp-uri ──────────────────────────────────────

  describe('POST /api/two-factor/get-totp-uri', () => {
    it('returns 200 with totpURI', async () => {
      twoFactorService.getTotpUri.mockResolvedValue('otpauth://totp/...');

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/get-totp-uri')
        .send({})
        .expect(200);

      expect(body.totpURI).toBe('otpauth://totp/...');
    });
  });

  // ─── POST /api/two-factor/verify-totp ───────────────────────────────────────

  describe('POST /api/two-factor/verify-totp', () => {
    it('returns 200 with ok and tokens', async () => {
      twoFactorService.verifyTotp.mockResolvedValue({
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
        trustCookieValue: null,
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/verify-totp')
        .send({ code: '123456' })
        .expect(200);

      expect(body.ok).toBe(true);
      expect(body.accessToken).toBe('at');
    });
  });

  // ─── POST /api/two-factor/send-otp ──────────────────────────────────────────

  describe('POST /api/two-factor/send-otp', () => {
    it('returns 200 with ok', async () => {
      twoFactorService.sendOtp.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/send-otp')
        .expect(200);

      expect(body.ok).toBe(true);
    });
  });

  // ─── POST /api/two-factor/verify-otp ────────────────────────────────────────

  describe('POST /api/two-factor/verify-otp', () => {
    it('returns 200 with ok and tokens', async () => {
      twoFactorService.verifyOtp.mockResolvedValue({
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
        trustCookieValue: null,
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/verify-otp')
        .send({ code: '123456' })
        .expect(200);

      expect(body.ok).toBe(true);
    });
  });

  // ─── POST /api/two-factor/verify-backup-code ────────────────────────────────

  describe('POST /api/two-factor/verify-backup-code', () => {
    it('returns 200 with ok and tokens', async () => {
      twoFactorService.verifyBackupCode.mockResolvedValue({
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
        trustCookieValue: null,
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/verify-backup-code')
        .send({ code: 'abcde-fghij' })
        .expect(200);

      expect(body.ok).toBe(true);
    });

    it('returns 400 when code format invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/two-factor/verify-backup-code')
        .send({ code: 'invalid' })
        .expect(400);
    });
  });

  // ─── POST /api/two-factor/generate-backup-codes ─────────────────────────────

  describe('POST /api/two-factor/generate-backup-codes', () => {
    it('returns 200 with backupCodes', async () => {
      twoFactorService.generateBackupCodes.mockResolvedValue(['a1b2c-d3e4f']);

      const { body } = await request(app.getHttpServer())
        .post('/api/two-factor/generate-backup-codes')
        .send({})
        .expect(200);

      expect(body.backupCodes).toEqual(['a1b2c-d3e4f']);
    });
  });
});
