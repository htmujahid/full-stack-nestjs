import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AccountController } from '../server/modules/identity/account/account.controller';
import { AccountService } from '../server/modules/identity/account/account.service';
import { Account } from '../server/modules/identity/account/account.entity';
import { mockRepository } from '../server/mocks/db.mock';

const makeAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'acc-uuid',
    accountId: 'google-123',
    providerId: 'google',
    userId: 'test-user-id',
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Account;

describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let accountRepo: ReturnType<typeof mockRepository>;

  beforeAll(async () => {
    accountRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        AccountService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.use((req: any, _res, next) => {
      req.user = req.user ?? { userId: 'test-user-id' };
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/accounts ─────────────────────────────────────────────────────

  describe('GET /api/accounts', () => {
    it('returns 200 with list of accounts', async () => {
      const accounts = [
        makeAccount(),
        makeAccount({
          id: 'acc-2',
          providerId: 'credential',
          accountId: 'test@example.com',
        }),
      ];
      accountRepo.find.mockResolvedValue(accounts);

      const { body } = await request(app.getHttpServer())
        .get('/api/accounts')
        .expect(200);

      expect(body).toHaveLength(2);
      expect(body[0].providerId).toBe('google');
    });

    it('returns empty array when no accounts', async () => {
      accountRepo.find.mockResolvedValue([]);

      const { body } = await request(app.getHttpServer())
        .get('/api/accounts')
        .expect(200);

      expect(body).toEqual([]);
    });
  });
});
