import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { ProjectController } from '../server/modules/desk/project/project.controller';
import { ProjectService } from '../server/modules/desk/project/project.service';
import { Project } from '../server/modules/desk/project/project.entity';
import { AuditService } from '../server/modules/core/audit/audit.service';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { mockRepository } from '../server/mocks/db.mock';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROJECT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ─── Factories ────────────────────────────────────────────────────────────────

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

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    projectRepo = Object.assign(mockRepository(), {
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    });
    qbMock = createQueryBuilderMock();
    projectRepo.createQueryBuilder.mockReturnValue(qbMock);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        ProjectService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
            logCreate: jest.fn().mockResolvedValue(undefined),
            logUpdate: jest.fn().mockResolvedValue(undefined),
            logDelete: jest.fn().mockResolvedValue(undefined),
            logCustom: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use((req: { user?: { userId: string; role: UserRole } }, _res: unknown, next: () => void) => {
      req.user = { userId: TEST_USER_ID, role: UserRole.Member };
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    qbMock.getManyAndCount.mockResolvedValue([[], 0]);
  });

  // ─── GET /api/projects ────────────────────────────────────────────────────

  describe('GET /api/projects', () => {
    it('returns 200 with paginated shape { data, total, page, limit }', async () => {
      const projects = [makeProject()];
      qbMock.getManyAndCount.mockResolvedValue([projects, 1]);

      const { body } = await request(app.getHttpServer())
        .get('/api/projects')
        .expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(PROJECT_ID);
      expect(body.data[0].name).toBe('My Project');
    });

    it('returns 200 with empty data when no projects exist', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      const { body } = await request(app.getHttpServer())
        .get('/api/projects')
        .expect(200);

      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('accepts userId filter with valid UUID', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';
      const projects = [makeProject({ userId: validUserId })];
      qbMock.getManyAndCount.mockResolvedValue([projects, 1]);

      const { body } = await request(app.getHttpServer())
        .get(`/api/projects?userId=${validUserId}`)
        .expect(200);

      expect(body.data).toHaveLength(1);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'project.userId = :userId',
        expect.objectContaining({ userId: validUserId }),
      );
    });

    it('accepts search, sortBy, sortOrder, page, limit query params', async () => {
      const projects = [makeProject()];
      qbMock.getManyAndCount.mockResolvedValue([projects, 1]);

      const { body } = await request(app.getHttpServer())
        .get(
          '/api/projects?search=acme&sortBy=createdAt&sortOrder=desc&page=2&limit=10',
        )
        .expect(200);

      expect(body.data).toHaveLength(1);
      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
      expect(qbMock.andWhere).toHaveBeenCalled();
      expect(qbMock.orderBy).toHaveBeenCalledWith('project.createdAt', 'DESC');
      expect(qbMock.skip).toHaveBeenCalledWith(10);
      expect(qbMock.take).toHaveBeenCalledWith(10);
    });
  });

  // ─── GET /api/projects/:id ────────────────────────────────────────────────

  describe('GET /api/projects/:id', () => {
    it('returns 200 with the project when found', async () => {
      projectRepo.findOneBy.mockResolvedValue(makeProject());

      const { body } = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}`)
        .expect(200);

      expect(body.id).toBe(PROJECT_ID);
      expect(body.name).toBe('My Project');
    });

    it('returns 404 when the project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}`)
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/projects/not-a-uuid')
        .expect(400);
    });
  });

  // ─── POST /api/projects ───────────────────────────────────────────────────

  describe('POST /api/projects', () => {
    it('returns 201 with the created project', async () => {
      const project = makeProject();
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
  });

  // ─── PATCH /api/projects/:id ──────────────────────────────────────────────

  describe('PATCH /api/projects/:id', () => {
    it('returns 200 when a member updates their own project', async () => {
      const updated = makeProject({ name: 'Renamed Project' });
      projectRepo.findOneBy.mockResolvedValue(makeProject());
      projectRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/projects/${PROJECT_ID}`)
        .send({ name: 'Renamed Project' })
        .expect(200);

      expect(body.name).toBe('Renamed Project');
    });

    it("returns 403 when a member updates another user's project", async () => {
      projectRepo.findOneBy.mockResolvedValue(
        makeProject({ userId: OTHER_USER_ID }),
      );

      await request(app.getHttpServer())
        .patch(`/api/projects/${PROJECT_ID}`)
        .send({ name: 'Updated' })
        .expect(403);
    });

    it('returns 404 when the project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

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
      projectRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/projects/${PROJECT_ID}`)
        .expect(204);
    });

    it("returns 403 when a member deletes another user's project", async () => {
      projectRepo.findOneBy.mockResolvedValue(
        makeProject({ userId: OTHER_USER_ID }),
      );

      await request(app.getHttpServer())
        .delete(`/api/projects/${PROJECT_ID}`)
        .expect(403);
    });

    it('returns 404 when the project does not exist', async () => {
      projectRepo.findOneBy.mockResolvedValue(null);

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
