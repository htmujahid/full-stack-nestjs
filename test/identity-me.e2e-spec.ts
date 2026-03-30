import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Module,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { MeController } from '../server/api/identity/me/me.controller';
import { User } from '../server/api/identity/user/user.entity';
import { mockRepository } from '../server/mocks/db.mock';

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

describe('Me (e2e)', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof mockRepository>;

  beforeAll(async () => {
    userRepo = mockRepository();

    @Module({
      controllers: [MeController],
      providers: [{ provide: getRepositoryToken(User), useValue: userRepo }],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/me', module: TestModule }])],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.use((req: any, _res, next) => {
      req.user = req.user ?? { userId: 'test-user-id' };
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/me ───────────────────────────────────────────────────────────

  describe('GET /api/me', () => {
    it('returns 200 with the authenticated user', async () => {
      const user = makeUser();
      userRepo.findOneOrFail.mockResolvedValue(user);

      const { body } = await request(app.getHttpServer())
        .get('/api/me')
        .expect(200);

      expect(body.id).toBe('test-user-id');
      expect(body.email).toBe('test@example.com');
    });

    it('returns 404 when user not found', async () => {
      userRepo.findOneOrFail.mockRejectedValue(new NotFoundException('User not found'));

      await request(app.getHttpServer()).get('/api/me').expect(404);
    });
  });

  // ─── PATCH /api/me ────────────────────────────────────────────────────────

  describe('PATCH /api/me', () => {
    it('returns 200 with updated user', async () => {
      const updated = makeUser({ name: 'New Name' });
      userRepo.update.mockResolvedValue({ affected: 1 });
      userRepo.findOneOrFail.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch('/api/me')
        .send({ name: 'New Name' })
        .expect(200);

      expect(body.name).toBe('New Name');
    });

    it('returns 400 when body has invalid data', async () => {
      await request(app.getHttpServer())
        .patch('/api/me')
        .send({ name: '', image: 'not-a-url' })
        .expect(400);
    });
  });
});
