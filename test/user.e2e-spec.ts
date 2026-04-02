import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  Module,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector, RouterModule } from '@nestjs/core';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { UserController } from '../server/api/identity/user/user.controller';
import { UserService } from '../server/api/identity/user/user.service';
import { User } from '../server/api/identity/user/user.entity';
import { UserRole } from '../server/api/identity/user/user-role.enum';
import { RolesGuard } from '../server/api/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/api/identity/rbac/permissions.guard';
import { mockDataSource, mockRepository } from '../server/mocks/db.mock';

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const testAuthGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const role = req.header('X-Test-Role') as UserRole | undefined;
    if (!role) throw new UnauthorizedException();
    req.user = { userId: 'test-user-id', role };
    return true;
  },
};

describe('User (e2e)', () => {
  let app: INestApplication;
  let repo: ReturnType<typeof mockRepository>;

  beforeAll(async () => {
    repo = mockRepository();

    @Module({
      controllers: [UserController],
      providers: [
        UserService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: getDataSourceToken(), useValue: mockDataSource() },
        { provide: APP_GUARD, useValue: testAuthGuard },
      ],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/users', module: TestModule }])],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findOneBy.mockReset();
  });

  const req = () => request(app.getHttpServer());
  const asAdmin = {
    get: (path: string) => req().get(path).set('X-Test-Role', UserRole.Admin),
    post: (path: string) => req().post(path).set('X-Test-Role', UserRole.Admin),
    patch: (path: string) => req().patch(path).set('X-Test-Role', UserRole.Admin),
    delete: (path: string) => req().delete(path).set('X-Test-Role', UserRole.Admin),
  };
  const asSuperAdmin = {
    get: (path: string) =>
      req().get(path).set('X-Test-Role', UserRole.SuperAdmin),
  };
  const asMember = {
    get: (path: string) => req().get(path).set('X-Test-Role', UserRole.Member),
  };

  // ─── Auth ──────────────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('returns 401 when unauthenticated', async () => {
      await req().get('/api/users').expect(401);
    });

    it('returns 403 when Member tries user routes', async () => {
      await asMember.get('/api/users').expect(403);
    });
  });

  // ─── GET /api/users ────────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('returns 200 with list of users when Admin', async () => {
      const users = [makeUser(), makeUser({ id: 'user-2', email: 'other@example.com' })];
      repo.findAndCount.mockResolvedValue([users, users.length]);

      const { body } = await asAdmin.get('/api/users').expect(200);

      expect(body.data).toHaveLength(2);
      expect(body.data[0].email).toBe('test@example.com');
      expect(body.data[1].email).toBe('other@example.com');
    });

    it('returns 200 with empty array when no users', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const { body } = await asAdmin.get('/api/users').expect(200);

      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('returns 200 when SuperAdmin', async () => {
      const users = [makeUser()];
      repo.findAndCount.mockResolvedValue([users, users.length]);

      const { body } = await asSuperAdmin.get('/api/users').expect(200);

      expect(body.data).toHaveLength(1);
    });
  });

  // ─── GET /api/users/:id ────────────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('returns 200 with user when Admin', async () => {
      const user = makeUser();
      repo.findOneBy.mockResolvedValue(user);

      const { body } = await asAdmin.get('/api/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').expect(200);

      expect(body.id).toBe(USER_ID);
      expect(body.email).toBe('test@example.com');
    });

    it('returns 404 when user not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await asAdmin
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await asAdmin.get('/api/users/invalid-id').expect(400);
    });
  });

  // ─── POST /api/users ───────────────────────────────────────────────────────

  describe('POST /api/users', () => {
    it('returns 201 with created user when Admin', async () => {
      const created = makeUser({
        id: 'new-user-id',
        name: 'New User',
        email: 'new@example.com',
      });
      repo.findOneBy.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const { body } = await asAdmin
        .post('/api/users')
        .send({ name: 'New User', email: 'new@example.com' })
        .expect(201);

      expect(body.id).toBe('new-user-id');
      expect(body.name).toBe('New User');
      expect(body.email).toBe('new@example.com');
    });

    it('returns 201 with optional fields', async () => {
      const created = makeUser({
        id: 'new-id',
        name: 'Full User',
        email: 'full@example.com',
        username: 'fulluser',
        phone: '+1234567890',
        role: UserRole.Admin,
        image: 'https://example.com/avatar.png',
      });
      repo.findOneBy.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const { body } = await asAdmin
        .post('/api/users')
        .send({
          name: 'Full User',
          email: 'full@example.com',
          username: 'fulluser',
          phone: '+1234567890',
          role: UserRole.Admin,
          image: 'https://example.com/avatar.png',
        })
        .expect(201);

      expect(body.username).toBe('fulluser');
      expect(body.phone).toBe('+1234567890');
      expect(body.role).toBe(UserRole.Admin);
      expect(body.image).toBe('https://example.com/avatar.png');
    });

    it('returns 409 when email already in use', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'other-id' });

      const { body } = await asAdmin
        .post('/api/users')
        .send({ name: 'New', email: 'existing@example.com' })
        .expect(409);

      expect(body.message).toMatch(/email/i);
    });

    it('returns 409 when username already in use', async () => {
      repo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'other-id' });

      const { body } = await asAdmin
        .post('/api/users')
        .send({
          name: 'New',
          email: 'new@example.com',
          username: 'taken',
        })
        .expect(409);

      expect(body.message).toMatch(/username/i);
    });

    it('returns 409 when phone already in use', async () => {
      repo.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'other-id' });

      const { body } = await asAdmin
        .post('/api/users')
        .send({
          name: 'New',
          email: 'new@example.com',
          username: 'newuser',
          phone: '+1234567890',
        })
        .expect(409);

      expect(body.message).toMatch(/phone/i);
    });

    it('returns 400 when body is invalid', async () => {
      await asAdmin.post('/api/users').send({}).expect(400);
    });

    it('returns 400 when email is invalid', async () => {
      await asAdmin
        .post('/api/users')
        .send({ name: 'New', email: 'not-an-email' })
        .expect(400);
    });
  });

  // ─── PATCH /api/users/:id ───────────────────────────────────────────────────

  describe('PATCH /api/users/:id', () => {
    it('returns 200 with updated user when Admin', async () => {
      const existing = makeUser();
      const updated = makeUser({ ...existing, name: 'Updated Name' });
      repo.findOneBy
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(null);
      repo.save.mockResolvedValue(updated);

      const { body } = await asAdmin
        .patch('/api/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(body.name).toBe('Updated Name');
    });

    it('returns 404 when user not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await asAdmin
        .patch('/api/users/00000000-0000-0000-0000-000000000000')
        .send({ name: 'New' })
        .expect(404);
    });

    it('returns 409 when updating to duplicate email', async () => {
      const existing = makeUser();
      repo.findOneBy
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other-id' });

      const { body } = await asAdmin
        .patch('/api/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .send({ email: 'taken@example.com' })
        .expect(409);

      expect(body.message).toMatch(/email/i);
    });

    it('returns 409 when updating to duplicate username', async () => {
      const existing = makeUser();
      repo.findOneBy.mockImplementation((where: Record<string, string>) => {
        if ('id' in where && where.id === USER_ID) return Promise.resolve(existing);
        if ('username' in where && where.username === 'taken')
          return Promise.resolve({ id: OTHER_ID });
        return Promise.resolve(null);
      });

      const { body } = await asAdmin
        .patch('/api/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .send({ username: 'taken' })
        .expect(409);

      expect(body.message).toMatch(/username/i);
    });

    it('returns 409 when updating to duplicate phone', async () => {
      const existing = makeUser();
      repo.findOneBy.mockImplementation((where: Record<string, string>) => {
        if ('id' in where && where.id === USER_ID) return Promise.resolve(existing);
        if ('phone' in where && where.phone === '+1234567890')
          return Promise.resolve({ id: OTHER_ID });
        return Promise.resolve(null);
      });

      const { body } = await asAdmin
        .patch('/api/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .send({ phone: '+1234567890' })
        .expect(409);

      expect(body.message).toMatch(/phone/i);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await asAdmin.patch('/api/users/invalid').send({ name: 'x' }).expect(400);
    });
  });

  // ─── DELETE /api/users/:id ──────────────────────────────────────────────────

  describe('DELETE /api/users/:id', () => {
    it('returns 204 when Admin', async () => {
      const user = makeUser();
      repo.findOneBy.mockImplementation((where: Record<string, string>) =>
        where.id === USER_ID ? Promise.resolve(user) : Promise.resolve(null),
      );
      repo.remove.mockResolvedValue(user);

      await asAdmin.delete('/api/users/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').expect(204);

      expect(repo.remove).toHaveBeenCalledWith(user);
    });

    it('returns 404 when user not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await asAdmin
        .delete('/api/users/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await asAdmin.delete('/api/users/invalid').expect(400);
    });
  });
});
