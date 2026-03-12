import {
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from '../server/modules/identity/auth/auth.constants';
import { GoogleController } from '../server/modules/identity/auth/controllers/google.controller';
import { GoogleService } from '../server/modules/identity/auth/services/google.service';
import { AccountService } from '../server/modules/identity/account/account.service';
import { TwoFactorGateService } from '../server/modules/identity/auth/services/two-factor-gate.service';
import { GoogleAuthGuard } from '../server/modules/identity/auth/guards/google-auth.guard';
import { LINK_INTENT_COOKIE } from '../server/modules/identity/auth/auth.constants';
import { User } from '../server/modules/identity/user/user.entity';
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('Identity Google (e2e)', () => {
  let app: INestApplication;
  let googleService: ReturnType<typeof mockGoogleService>;
  let accountService: ReturnType<typeof mockAccountService>;
  let jwtService: ReturnType<typeof mockJwtService>;

  function mockGoogleService() {
    return {
      findOrCreateUser: jest.fn(),
      createSession: jest.fn(),
    };
  }
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
    googleService = mockGoogleService();
    accountService = mockAccountService();
    jwtService = mockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleController],
      providers: [
        { provide: GoogleService, useValue: googleService },
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
      .overrideGuard(GoogleAuthGuard)
      .useValue(setUserGuard(mockGoogleProfile))
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/auth/google ──────────────────────────────────────────────────

  describe('GET /api/auth/google', () => {
    it('returns 200 when guard is overridden (no real OAuth)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/google')
        .expect(200);
      expect(res.body).toEqual({});
    });
  });

  // ─── GET /api/auth/google/callback ─────────────────────────────────────────

  describe('GET /api/auth/google/callback', () => {
    it('redirects to / on successful sign-in', async () => {
      const user = makeUser();
      googleService.findOrCreateUser.mockResolvedValue(user);
      googleService.createSession.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        refreshExpiresAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .expect(302);

      expect(res.headers.location).toBe('/');
    });

    it('redirects to /settings/accounts?linked=google when link intent', async () => {
      jwtService.verify.mockImplementation(() => ({ sub: 'test-user-id' }));
      accountService.linkAccount.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .set(
          'Cookie',
          [`${LINK_INTENT_COOKIE}=google`, `${ACCESS_TOKEN_COOKIE}=valid-token`].join('; '),
        )
        .expect(302);

      expect(res.headers.location).toBe('/settings/accounts?linked=google');
    });

    it('redirects to error when link intent but no access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .set('Cookie', `${LINK_INTENT_COOKIE}=google`)
        .expect(302);

      expect(res.headers.location).toBe(
        '/settings/accounts?error=not_authenticated',
      );
    });
  });
});
