import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from '../server/modules/identity/auth/controllers/auth.controller';
import { PasswordController } from '../server/modules/identity/auth/controllers/password.controller';
import { EmailController } from '../server/modules/identity/auth/controllers/email.controller';
import { PhoneController } from '../server/modules/identity/auth/controllers/phone.controller';
import { AuthService } from '../server/modules/identity/auth/services/auth.service';
import { PasswordService } from '../server/modules/identity/auth/services/password.service';
import { EmailService } from '../server/modules/identity/auth/services/email.service';
import { PhoneService } from '../server/modules/identity/auth/services/phone.service';
import { TwoFactorGateService } from '../server/modules/identity/auth/services/two-factor-gate.service';
import { JwtRefreshGuard } from '../server/modules/identity/auth/guards/jwt-refresh.guard';
import { PasswordAuthGuard } from '../server/modules/identity/auth/guards/password-auth.guard';
import { JwtFreshGuard } from '../server/modules/identity/auth/guards/jwt-fresh.guard';
import { User } from '../server/modules/identity/user/user.entity';

const throttlerGuard = { canActivate: () => true };

const setUserGuard = (user: object) => ({
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = user;
    return true;
  },
});

const refreshUser = {
  userId: 'test-user-id',
  sessionId: 's1',
  familyId: 'f1',
  rawRefreshToken: 'rt',
};

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('Identity Auth (e2e)', () => {
  let app: INestApplication;
  let authService: ReturnType<typeof mockAuthService>;
  let passwordService: ReturnType<typeof mockPasswordService>;
  let emailService: ReturnType<typeof mockEmailService>;
  let phoneService: ReturnType<typeof mockPhoneService>;
  let twoFactorGate: ReturnType<typeof mockTwoFactorGateService>;

  function mockAuthService() {
    return {
      refreshTokens: jest.fn(),
      signOut: jest.fn(),
    };
  }
  function mockPasswordService() {
    return {
      signUp: jest.fn(),
      signIn: jest.fn(),
      forgotPassword: jest.fn(),
      validateResetPasswordToken: jest.fn(),
      resetPassword: jest.fn(),
      updatePassword: jest.fn(),
    };
  }
  function mockEmailService() {
    return {
      sendSignInLink: jest.fn(),
      verifySignInLink: jest.fn(),
      resendVerificationEmail: jest.fn(),
      verifyEmail: jest.fn(),
      initiateEmailChange: jest.fn(),
      verifyEmailChange: jest.fn(),
    };
  }
  function mockPhoneService() {
    return {
      sendSignInOtp: jest.fn(),
      verifySignInOtp: jest.fn(),
      sendVerificationOtp: jest.fn(),
      verifyPhone: jest.fn(),
      initiatePhoneChange: jest.fn(),
      verifyPhoneChange: jest.fn(),
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
    authService = mockAuthService();
    passwordService = mockPasswordService();
    emailService = mockEmailService();
    phoneService = mockPhoneService();
    twoFactorGate = mockTwoFactorGateService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        PasswordController,
        EmailController,
        PhoneController,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PasswordService, useValue: passwordService },
        { provide: EmailService, useValue: emailService },
        { provide: PhoneService, useValue: phoneService },
        { provide: TwoFactorGateService, useValue: twoFactorGate },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(throttlerGuard)
      .overrideGuard(JwtRefreshGuard)
      .useValue(setUserGuard(refreshUser))
      .overrideGuard(PasswordAuthGuard)
      .useValue(setUserGuard(makeUser()))
      .overrideGuard(JwtFreshGuard)
      .useValue(setUserGuard({ userId: 'test-user-id' }))
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/auth/refresh ───────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('returns 200 with ok and tokens', async () => {
      authService.refreshTokens.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        refreshExpiresAt: new Date(),
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .expect(200);

      expect(body).toEqual({ ok: true, accessToken: 'at', refreshToken: 'rt' });
    });
  });

  // ─── POST /api/auth/sign-out ───────────────────────────────────────────────

  describe('POST /api/auth/sign-out', () => {
    it('returns 200 with ok', async () => {
      authService.signOut.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/sign-out')
        .expect(200);

      expect(body).toEqual({ ok: true });
    });
  });

  // ─── POST /api/auth/sign-up/password ───────────────────────────────────────

  describe('POST /api/auth/sign-up/password', () => {
    it('returns 200 with user', async () => {
      const user = makeUser();
      passwordService.signUp.mockResolvedValue({ user });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/sign-up/password')
        .send({ name: 'Test', email: 'test@example.com', password: 'password123' })
        .expect(201);

      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('test@example.com');
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/sign-up/password')
        .send({})
        .expect(400);
    });
  });

  // ─── POST /api/auth/sign-in/password ──────────────────────────────────────

  describe('POST /api/auth/sign-in/password', () => {
    it('returns 200 with user and tokens when 2FA disabled', async () => {
      const user = makeUser({ twoFactorEnabled: false });
      passwordService.signIn.mockResolvedValue({
        user,
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/sign-in/password')
        .send({ identifier: 'test@example.com', password: 'pass123' })
        .expect(200);

      expect(body.user).toBeDefined();
      expect(body.accessToken).toBe('at');
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/sign-in/password')
        .send({})
        .expect(400);
    });
  });

  // ─── POST /api/auth/forgot-password ───────────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 with ok', async () => {
      passwordService.forgotPassword.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(body).toEqual({ ok: true });
    });

    it('returns 400 when email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);
    });
  });

  // ─── GET /api/auth/reset-password/:token ───────────────────────────────────

  describe('GET /api/auth/reset-password/:token', () => {
    it('redirects to callbackURL with token when valid', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .get('/api/auth/reset-password/abc123')
        .query({ callbackURL: 'https://app.example.com/reset' })
        .expect(302);

      expect(res.headers.location).toMatch(/token=abc123/);
    });

    it('redirects with error when invalid token', async () => {
      passwordService.validateResetPasswordToken.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .get('/api/auth/reset-password/invalid')
        .query({ callbackURL: 'https://app.example.com/reset' })
        .expect(302);

      expect(res.headers.location).toMatch(/error=INVALID_TOKEN/);
    });
  });

  // ─── POST /api/auth/reset-password ─────────────────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('returns 200 with ok', async () => {
      passwordService.resetPassword.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: 'abc123', newPassword: 'newpassword123' })
        .expect(200);

      expect(body).toEqual({ ok: true });
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({})
        .expect(400);
    });
  });

  // ─── PATCH /api/auth/password ───────────────────────────────────────────────

  describe('PATCH /api/auth/password', () => {
    it('returns 200', async () => {
      passwordService.updatePassword.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .patch('/api/auth/password')
        .send({ newPassword: 'newpassword123' })
        .expect(200);

      expect(body).toBeDefined();
    });

    it('returns 400 when password too short', async () => {
      await request(app.getHttpServer())
        .patch('/api/auth/password')
        .send({ newPassword: 'short' })
        .expect(400);
    });
  });

  // ─── POST /api/auth/sign-in/email ───────────────────────────────────────────

  describe('POST /api/auth/sign-in/email', () => {
    it('returns 200 with ok', async () => {
      emailService.sendSignInLink.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(body).toEqual({ ok: true });
    });

    it('returns 400 when email invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({})
        .expect(400);
    });
  });

  // ─── GET /api/auth/verify-email-link ────────────────────────────────────────

  describe('GET /api/auth/verify-email-link', () => {
    it('returns 200 with ok and tokens when valid', async () => {
      const user = makeUser();
      emailService.verifySignInLink.mockResolvedValue({
        ok: true,
        user,
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
      });

      const { body } = await request(app.getHttpServer())
        .get('/api/auth/verify-email-link')
        .query({ token: 'valid-token' })
        .expect(200);

      expect(body.ok).toBe(true);
      expect(body.accessToken).toBe('at');
    });

    it('returns ok false when invalid', async () => {
      emailService.verifySignInLink.mockResolvedValue({
        ok: false,
        error: 'INVALID_TOKEN',
      });

      const { body } = await request(app.getHttpServer())
        .get('/api/auth/verify-email-link')
        .query({ token: 'bad-token' })
        .expect(200);

      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  // ─── POST /api/auth/send-verification-email ─────────────────────────────────

  describe('POST /api/auth/send-verification-email', () => {
    it('returns 200 with ok', async () => {
      emailService.resendVerificationEmail.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/send-verification-email')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(body).toEqual({ ok: true });
    });
  });

  // ─── GET /api/auth/verify-email ─────────────────────────────────────────────

  describe('GET /api/auth/verify-email', () => {
    it('returns 200 with ok and tokens when valid', async () => {
      emailService.verifyEmail.mockResolvedValue({
        ok: true,
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
      });

      const { body } = await request(app.getHttpServer())
        .get('/api/auth/verify-email')
        .query({ token: 'valid-token' })
        .expect(200);

      expect(body.ok).toBe(true);
      expect(body.accessToken).toBe('at');
    });
  });

  // ─── PATCH /api/auth/email ──────────────────────────────────────────────────

  describe('PATCH /api/auth/email', () => {
    it('returns 200', async () => {
      emailService.initiateEmailChange.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .patch('/api/auth/email')
        .send({ newEmail: 'new@example.com' })
        .expect(200);

      expect(body).toBeDefined();
    });

    it('returns 400 when email invalid', async () => {
      await request(app.getHttpServer())
        .patch('/api/auth/email')
        .send({ newEmail: 'invalid' })
        .expect(400);
    });
  });

  // ─── GET /api/auth/verify-email-change ──────────────────────────────────────

  describe('GET /api/auth/verify-email-change', () => {
    it('returns 200 with ok when valid', async () => {
      emailService.verifyEmailChange.mockResolvedValue({ ok: true });

      const { body } = await request(app.getHttpServer())
        .get('/api/auth/verify-email-change')
        .query({ token: 'valid-token' })
        .expect(200);

      expect(body.ok).toBe(true);
    });
  });

  // ─── POST /api/auth/sign-in/phone ───────────────────────────────────────────

  describe('POST /api/auth/sign-in/phone', () => {
    it('returns 200 with ok', async () => {
      phoneService.sendSignInOtp.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/sign-in/phone')
        .send({ phone: '+1234567890' })
        .expect(200);

      expect(body).toEqual({ ok: true });
    });

    it('returns 400 when phone missing', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/sign-in/phone')
        .send({})
        .expect(400);
    });
  });

  // ─── POST /api/auth/verify-phone-otp ────────────────────────────────────────

  describe('POST /api/auth/verify-phone-otp', () => {
    it('returns 200 with user and tokens', async () => {
      const user = makeUser();
      phoneService.verifySignInOtp.mockResolvedValue({
        user,
        tokens: {
          accessToken: 'at',
          refreshToken: 'rt',
          refreshExpiresAt: new Date(),
        },
      });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/verify-phone-otp')
        .send({ phone: '+1234567890', code: '123456' })
        .expect(200);

      expect(body.user).toBeDefined();
      expect(body.accessToken).toBe('at');
    });
  });

  // ─── POST /api/auth/send-verification-phone ──────────────────────────────────

  describe('POST /api/auth/send-verification-phone', () => {
    it('returns 200 with ok', async () => {
      phoneService.sendVerificationOtp.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/send-verification-phone')
        .send({ phone: '+1234567890' })
        .expect(200);

      expect(body).toEqual({ ok: true });
    });
  });

  // ─── POST /api/auth/verify-phone ─────────────────────────────────────────────

  describe('POST /api/auth/verify-phone', () => {
    it('returns 200 with ok when valid', async () => {
      phoneService.verifyPhone.mockResolvedValue({ ok: true });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/verify-phone')
        .send({ phone: '+1234567890', code: '123456' })
        .expect(200);

      expect(body.ok).toBe(true);
    });

    it('returns 200 with ok false when invalid', async () => {
      phoneService.verifyPhone.mockResolvedValue({ ok: false, error: 'INVALID' });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/verify-phone')
        .send({ phone: '+1234567890', code: 'wrong' })
        .expect(200);

      expect(body.ok).toBe(false);
    });
  });

  // ─── PATCH /api/auth/phone ──────────────────────────────────────────────────

  describe('PATCH /api/auth/phone', () => {
    it('returns 200', async () => {
      phoneService.initiatePhoneChange.mockResolvedValue(undefined);

      const { body } = await request(app.getHttpServer())
        .patch('/api/auth/phone')
        .send({ newPhone: '+1987654321' })
        .expect(200);

      expect(body).toBeDefined();
    });
  });

  // ─── POST /api/auth/verify-phone-change ──────────────────────────────────────

  describe('POST /api/auth/verify-phone-change', () => {
    it('returns 200 with ok when valid', async () => {
      phoneService.verifyPhoneChange.mockResolvedValue({ ok: true });

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/verify-phone-change')
        .send({ phone: '+1987654321', code: '123456' })
        .expect(200);

      expect(body.ok).toBe(true);
    });
  });
});
