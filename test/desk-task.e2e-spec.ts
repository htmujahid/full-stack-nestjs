import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { TaskController } from '../server/modules/desk/task/task.controller';
import { TaskService } from '../server/modules/desk/task/task.service';
import { Task } from '../server/modules/desk/task/task.entity';
import { ProjectService } from '../server/modules/desk/project/project.service';
import { Project } from '../server/modules/desk/project/project.entity';
import { TaskStatus } from '../server/modules/desk/task/task-status.enum';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { mockRepository } from '../server/mocks/db.mock';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const TASK_ID = '550e8400-e29b-41d4-a716-446655440003';

const makeProject = (overrides: Partial<Project> = {}): Project =>
  ({
    id: PROJECT_ID,
    name: 'My Project',
    description: null,
    userId: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Project;

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: TASK_ID,
    title: 'My Task',
    description: null,
    status: TaskStatus.Todo,
    projectId: PROJECT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Task;

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let taskRepo: ReturnType<typeof mockRepository> & {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    taskRepo = Object.assign(mockRepository(), {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    });
    qbMock = createQueryBuilderMock();
    taskRepo.createQueryBuilder.mockReturnValue(qbMock);

    projectRepo = Object.assign(mockRepository(), { findOneBy: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        TaskService,
        ProjectService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use(
      (
        req: { user?: { userId: string; role: UserRole } },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = { userId: TEST_USER_ID, role: UserRole.Member };
        next();
      },
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    qbMock.getManyAndCount.mockResolvedValue([[], 0]);
  });

  describe('GET /api/tasks', () => {
    it('returns 200 with paginated shape { data, total, page, limit }', async () => {
      const tasks = [makeTask()];
      qbMock.getManyAndCount.mockResolvedValue([tasks, 1]);

      const { body } = await request(app.getHttpServer())
        .get('/api/tasks')
        .expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(body.data[0].title).toBe('My Task');
      expect(body.data[0].projectId).toBe(PROJECT_ID);
    });

    it('accepts projectId, search, status, sortBy, sortOrder, page, limit', async () => {
      const tasks = [makeTask()];
      qbMock.getManyAndCount.mockResolvedValue([tasks, 1]);

      const { body } = await request(app.getHttpServer())
        .get(
          `/api/tasks?projectId=${PROJECT_ID}&search=bug&status=todo&status=done&sortBy=title&sortOrder=asc&page=2&limit=10`,
        )
        .expect(200);

      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
      expect(qbMock.andWhere).toHaveBeenCalled();
      expect(qbMock.orderBy).toHaveBeenCalledWith('task.title', 'ASC');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns 200 with task when found', async () => {
      const task = makeTask();
      taskRepo.findOne.mockResolvedValue(task);

      const { body } = await request(app.getHttpServer())
        .get(`/api/tasks/${TASK_ID}`)
        .expect(200);

      expect(body.id).toBe(TASK_ID);
      expect(body.title).toBe('My Task');
    });

    it('returns 404 when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/tasks/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });

    it('returns 400 when id is not valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/tasks/invalid')
        .expect(400);
    });
  });

  describe('POST /api/tasks', () => {
    it('returns 201 with created task when user owns project', async () => {
      const project = makeProject();
      const created = makeTask({ title: 'New Task' });
      projectRepo.findOneBy.mockResolvedValue(project);
      taskRepo.create.mockReturnValue(created);
      taskRepo.save.mockResolvedValue(created);

      const { body } = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'New Task', projectId: PROJECT_ID })
        .expect(201);

      expect(body.title).toBe('New Task');
      expect(body.projectId).toBe(PROJECT_ID);
      expect(body.status).toBe(TaskStatus.Todo);
    });

    it('returns 403 when user does not own project', async () => {
      const project = makeProject({ userId: OTHER_USER_ID });
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'New Task', projectId: PROJECT_ID })
        .expect(403);
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('returns 200 when user owns project', async () => {
      const task = makeTask();
      const project = makeProject();
      const updated = makeTask({ title: 'Updated' });
      taskRepo.findOne.mockResolvedValue(task);
      projectRepo.findOneBy.mockResolvedValue(project);
      taskRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/tasks/${TASK_ID}`)
        .send({ title: 'Updated' })
        .expect(200);

      expect(body.title).toBe('Updated');
    });

    it('returns 403 when user does not own project', async () => {
      const task = makeTask();
      const project = makeProject({ userId: OTHER_USER_ID });
      taskRepo.findOne.mockResolvedValue(task);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .patch(`/api/tasks/${TASK_ID}`)
        .send({ title: 'Updated' })
        .expect(403);
    });

    it('returns 404 when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/api/tasks/550e8400-e29b-41d4-a716-446655440099`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('returns 204 when user owns project', async () => {
      const task = makeTask();
      const project = makeProject();
      taskRepo.findOne.mockResolvedValue(task);
      projectRepo.findOneBy.mockResolvedValue(project);
      taskRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/tasks/${TASK_ID}`)
        .expect(204);

      expect(taskRepo.remove).toHaveBeenCalledWith(task);
    });

    it('returns 403 when user does not own project', async () => {
      const task = makeTask();
      const project = makeProject({ userId: OTHER_USER_ID });
      taskRepo.findOne.mockResolvedValue(task);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .delete(`/api/tasks/${TASK_ID}`)
        .expect(403);
    });

    it('returns 404 when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/api/tasks/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });
  });
});
