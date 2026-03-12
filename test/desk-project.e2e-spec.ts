import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { ProjectController } from '../server/modules/desk/project/project.controller';
import { ProjectService } from '../server/modules/desk/project/project.service';
import { Project } from '../server/modules/desk/project/project.entity';
import { User } from '../server/modules/identity/user/user.entity';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { CaslAbilityFactory } from '../server/modules/identity/rbac/casl-ability.factory';
import { PoliciesGuard } from '../server/modules/identity/rbac/policies.guard';
import { mockRepository } from '../server/mocks/db.mock';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROJECT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    image: null,
    role: UserRole.Member,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

const makeProject = (overrides: Partial<Project> = {}): Project =>
  Object.assign(new Project(), {
    id: PROJECT_ID,
    name: 'My Project',
    description: null,
    userId: TEST_USER_ID,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
  };
  let userRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
  };

  beforeAll(async () => {
    projectRepo = Object.assign(mockRepository(), { findOneBy: jest.fn() });
    userRepo = Object.assign(mockRepository(), { findOneBy: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        ProjectService,
        CaslAbilityFactory,
        PoliciesGuard,
        Reflector,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use((req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
      req.user = { userId: TEST_USER_ID };
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/projects ────────────────────────────────────────────────────

  describe('GET /api/projects', () => {
    it('returns 200 with an array of projects', async () => {
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.find.mockResolvedValue([makeProject()]);

      const { body } = await request(app.getHttpServer())
        .get('/api/projects')
        .expect(200);

      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(PROJECT_ID);
      expect(body[0].name).toBe('My Project');
    });

    it('returns 200 with an empty array when no projects exist', async () => {
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.find.mockResolvedValue([]);

      const { body } = await request(app.getHttpServer())
        .get('/api/projects')
        .expect(200);

      expect(body).toHaveLength(0);
    });

    it('returns 403 when the requesting user is not found', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/api/projects').expect(403);
    });
  });

  // ─── GET /api/projects/:id ────────────────────────────────────────────────

  describe('GET /api/projects/:id', () => {
    it('returns 200 with the project when found', async () => {
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.findOneBy.mockResolvedValue(makeProject());

      const { body } = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}`)
        .expect(200);

      expect(body.id).toBe(PROJECT_ID);
      expect(body.name).toBe('My Project');
    });

    it('returns 404 when the project does not exist', async () => {
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.findOneBy.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}`)
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      userRepo.findOneBy.mockResolvedValue(makeUser());

      await request(app.getHttpServer())
        .get('/api/projects/not-a-uuid')
        .expect(400);
    });

    it('returns 403 when the requesting user is not found', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}`)
        .expect(403);
    });
  });

  // ─── POST /api/projects ───────────────────────────────────────────────────

  describe('POST /api/projects', () => {
    it('returns 201 with the created project', async () => {
      const project = makeProject();
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.create.mockReturnValue(project);
      projectRepo.save.mockResolvedValue(project);

      const { body } = await request(app.getHttpServer())
        .post('/api/projects')
        .send({ name: 'My Project' })
        .expect(201);

      expect(body.id).toBe(PROJECT_ID);
      expect(body.name).toBe('My Project');
    });

    it('returns 201 with the created project including description', async () => {
      const project = makeProject({ description: 'A description' });
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.create.mockReturnValue(project);
      projectRepo.save.mockResolvedValue(project);

      const { body } = await request(app.getHttpServer())
        .post('/api/projects')
        .send({ name: 'My Project', description: 'A description' })
        .expect(201);

      expect(body.description).toBe('A description');
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({})
        .expect(400);
    });

    it('returns 400 when name exceeds 255 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({ name: 'a'.repeat(256) })
        .expect(400);
    });

    it('returns 403 when the requesting user is not found', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/projects')
        .send({ name: 'My Project' })
        .expect(403);
    });
  });

  // ─── PATCH /api/projects/:id ──────────────────────────────────────────────

  describe('PATCH /api/projects/:id', () => {
    it('returns 200 when a member updates their own project', async () => {
      const updated = makeProject({ name: 'Renamed Project' });
      projectRepo.findOneBy.mockResolvedValue(makeProject());
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/projects/${PROJECT_ID}`)
        .send({ name: 'Renamed Project' })
        .expect(200);

      expect(body.name).toBe('Renamed Project');
    });

    it('returns 200 when a member updates another user\'s project', async () => {
      const updated = makeProject({ userId: OTHER_USER_ID, name: 'Updated' });
      projectRepo.findOneBy.mockResolvedValue(
        makeProject({ userId: OTHER_USER_ID }),
      );
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/projects/${PROJECT_ID}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(body.name).toBe('Updated');
    });

    it('returns 404 when the project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);
      userRepo.findOneBy.mockResolvedValue(makeUser());

      await request(app.getHttpServer())
        .patch(`/api/projects/${PROJECT_ID}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .patch('/api/projects/not-a-uuid')
        .send({ name: 'Updated' })
        .expect(400);
    });
  });

  // ─── DELETE /api/projects/:id ─────────────────────────────────────────────

  describe('DELETE /api/projects/:id', () => {
    it('returns 204 when a member deletes their own project', async () => {
      projectRepo.findOneBy.mockResolvedValue(makeProject());
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/projects/${PROJECT_ID}`)
        .expect(204);
    });

    it('returns 204 when a member deletes another user\'s project', async () => {
      projectRepo.findOneBy.mockResolvedValue(
        makeProject({ userId: OTHER_USER_ID }),
      );
      userRepo.findOneBy.mockResolvedValue(makeUser());
      projectRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/projects/${PROJECT_ID}`)
        .expect(204);
    });

    it('returns 404 when the project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);
      userRepo.findOneBy.mockResolvedValue(makeUser());

      await request(app.getHttpServer())
        .delete(`/api/projects/${PROJECT_ID}`)
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .delete('/api/projects/not-a-uuid')
        .expect(400);
    });
  });
});
