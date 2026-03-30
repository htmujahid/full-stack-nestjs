import {
  ExecutionContext,
  INestApplication,
  Module,
} from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import { OAUTH_REDIRECT_COOKIE } from '../server/api/identity/auth/auth.constants';
import { GoogleController } from '../server/api/identity/oauth/controllers/google.controller';
import { AccountService } from '../server/api/identity/account/account.service';
import { AuthService } from '../server/api/identity/auth/services/auth.service';
import { TwoFactorGateService } from '../server/api/identity/auth/services/two-factor-gate.service';
import { GoogleAuthGuard } from '../server/api/identity/oauth/guards/google-auth.guard';
import { User } from '../server/api/identity/user/user.entity';
import { UserRole } from '../server/api/identity/user/user-role.enum';
import { Test, TestingModule } from '@nestjs/testing';

const mockGoogleProfile = {
  providerId: 'google',
  accountId: 'google-123',
  email: 'test@gmail.com',
  name: 'Test User',
  image: null as string | null,
  accessToken: 'ga-at',
  refreshToken: 'ga-rt',
};

const setUserGuard = (user: object) => ({
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = user;
    return true;
  },
});

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@gmail.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    image: null,
    role: UserRole.Member,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('Identity Google (e2e)', () => {
  let app: INestApplication;
  let controller: GoogleController;
  let authService: { createAuthSession: jest.Mock };
  let accountService: ReturnType<typeof mockAccountService>;
  let jwtService: ReturnType<typeof mockJwtService>;

  function mockAccountService() {
    return {
      linkAccount: jest.fn(),
    };
  }
  function mockJwtService() {
    return {
      verify: jest.fn(),
    };
  }

  beforeAll(async () => {
    authService = { createAuthSession: jest.fn() };
    accountService = mockAccountService();
    jwtService = mockJwtService();

    @Module({
      controllers: [GoogleController],
      providers: [
        { provide: getDataSourceToken(), useValue: { transaction: jest.fn() } },
        { provide: AuthService, useValue: authService },
        { provide: AccountService, useValue: accountService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: TwoFactorGateService,
          useValue: {
            checkTrustDevice: jest.fn(),
            createPendingToken: jest.fn(),
            rotateTrustDevice: jest.fn(),
          },
        },
      ],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/oauth/google', module: TestModule }])],
    })
      .overrideGuard(GoogleAuthGuard)
      .useValue(setUserGuard(mockGoogleProfile))
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    controller = module.get(GoogleController);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/oauth/google ──────────────────────────────────────────────────

  describe('GET /api/oauth/google', () => {
    it('returns 200 when guard is overridden (no real OAuth)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/oauth/google')
        .expect(200);
      expect(res.body).toEqual({});
    });
  });

  // ─── GET /api/oauth/google/callback ─────────────────────────────────────────

  describe('GET /api/oauth/google/callback', () => {
    it('redirects to / on successful sign-in', async () => {
      const user = makeUser();
      jest.spyOn(controller, 'findOrCreateUser').mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        refreshExpiresAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/oauth/google/callback')
        .expect(302);

      expect(res.headers.location).toBe('/');
    });

    it('redirects to OAUTH_REDIRECT_COOKIE path on successful sign-in', async () => {
      const user = makeUser();
      jest.spyOn(controller, 'findOrCreateUser').mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        refreshExpiresAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/oauth/google/callback')
        .set('Cookie', `${OAUTH_REDIRECT_COOKIE}=/dashboard`)
        .expect(302);

      expect(res.headers.location).toBe('/dashboard');
    });

    it('clears oauth_redirect cookie after sign-in', async () => {
      const user = makeUser();
      jest.spyOn(controller, 'findOrCreateUser').mockResolvedValue(user);
      authService.createAuthSession.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        refreshExpiresAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/oauth/google/callback')
        .set('Cookie', `${OAUTH_REDIRECT_COOKIE}=/dashboard`)
        .expect(302);

      const setCookieHeader: string[] = ([] as string[]).concat(
        res.headers['set-cookie'] ?? [],
      );
      expect(setCookieHeader.some((c) => c.startsWith(`${OAUTH_REDIRECT_COOKIE}=;`))).toBe(true);
    });
  });
});
