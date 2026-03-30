import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Reflector, RouterModule } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ImportController } from '../server/api/data/import/import.controller';
import { ImportService } from '../server/api/data/import/import.service';
import { ExportController } from '../server/api/data/export/export.controller';
import { ExportService } from '../server/api/data/export/export.service';
import { ReportController } from '../server/api/data/report/report.controller';
import { ReportService } from '../server/api/data/report/report.service';
import { Task } from '../server/api/desk/task/task.entity';
import { Project } from '../server/api/desk/project/project.entity';
import { TaskStatus } from '../server/api/desk/task/task-status.enum';
import { RolesGuard } from '../server/api/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/api/identity/rbac/permissions.guard';
import { UserRole } from '../server/api/identity/user/user-role.enum';
import { mockRepository } from '../server/mocks/db.mock';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROJECT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TASK_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

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

const makeTask = (overrides: Partial<Task> = {}): Task =>
  Object.assign(new Task(), {
    id: TASK_ID,
    title: 'My Task',
    description: null,
    status: TaskStatus.Todo,
    projectId: PROJECT_ID,
    project: makeProject(),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Data (e2e)', () => {
  let app: INestApplication;
  let taskRepo: ReturnType<typeof mockRepository>;
  let projectRepo: ReturnType<typeof mockRepository>;

  beforeAll(async () => {
    taskRepo = mockRepository();
    projectRepo = mockRepository();

    @Module({
      controllers: [ImportController],
      providers: [
        ImportService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    })
    class TestImportModule {}

    @Module({
      controllers: [ExportController],
      providers: [
        ExportService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    })
    class TestExportModule {}

    @Module({
      controllers: [ReportController],
      providers: [
        ReportService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    })
    class TestReportModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestImportModule,
        TestExportModule,
        TestReportModule,
        RouterModule.register([
          { path: 'api/data/import', module: TestImportModule },
          { path: 'api/data/export', module: TestExportModule },
          { path: 'api/data/report', module: TestReportModule },
        ]),
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.use((req: { user?: { userId: string; role: UserRole }; header: (n: string) => string }, res: { status: (n: number) => { json: (o: object) => void } }, next: () => void) => {
      const role = req.header('X-Test-Role') as UserRole | undefined;
      if (!role) {
        return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      }
      req.user = { userId: TEST_USER_ID, role };
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  const req = () => request(app.getHttpServer());

  // ─── Auth ───────────────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('returns 401 when unauthenticated on import preview', async () => {
      await req()
        .post('/api/data/import/preview')
        .attach('file', Buffer.from('a,b\n1,2', 'utf-8'), {
          filename: 'test.csv',
          contentType: 'text/csv',
        })
        .expect(401);
    });

    it('returns 401 when unauthenticated on export', async () => {
      await req().get('/api/data/export?entity=tasks&format=json').expect(401);
    });

    it('returns 401 when unauthenticated on report summary', async () => {
      await req().get('/api/data/report/summary').expect(401);
    });

    it('returns 403 when authenticated but not Admin/Member', async () => {
      await req()
        .get('/api/data/report/summary')
        .set('X-Test-Role', UserRole.SuperAdmin)
        .expect(403);
    });
  });

  // ─── POST /api/data/import/preview ───────────────────────────────────────────

  describe('POST /api/data/import/preview', () => {
    it('returns 200 with CSV preview { format, rowCount, columns, preview }', async () => {
      const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
      const { body } = await req()
        .post('/api/data/import/preview')
        .set('X-Test-Role', UserRole.Member)
        .attach('file', Buffer.from(csv, 'utf-8'), {
          filename: 'data.csv',
          contentType: 'text/csv',
        })
        .expect(200);

      expect(body).toMatchObject({
        format: 'csv',
        rowCount: 2,
        columns: ['name', 'age', 'city'],
      });
      expect(body.preview).toHaveLength(2);
      expect(body.preview[0]).toEqual({ name: 'Alice', age: '30', city: 'NYC' });
      expect(body.preview[1]).toEqual({ name: 'Bob', age: '25', city: 'LA' });
    });

    it('returns 200 with JSON preview when file is application/json', async () => {
      const json = JSON.stringify([
        { id: '1', title: 'Task A' },
        { id: '2', title: 'Task B' },
      ]);
      const { body } = await req()
        .post('/api/data/import/preview')
        .set('X-Test-Role', UserRole.Member)
        .attach('file', Buffer.from(json, 'utf-8'), {
          filename: 'data.json',
          contentType: 'application/json',
        })
        .expect(200);

      expect(body).toMatchObject({
        format: 'json',
        rowCount: 2,
        columns: ['id', 'title'],
      });
      expect(body.preview).toHaveLength(2);
      expect(body.preview[0]).toEqual({ id: '1', title: 'Task A' });
    });

    it('returns 422 when file is missing', async () => {
      await req()
        .post('/api/data/import/preview')
        .set('X-Test-Role', UserRole.Member)
        .expect(422);
    });
  });

  // ─── GET /api/data/export ───────────────────────────────────────────────────

  describe('GET /api/data/export', () => {
    it('returns 200 with JSON array when format=json and entity=tasks', async () => {
      const tasks = [makeTask()];
      taskRepo.find.mockResolvedValue(tasks);

      const { body } = await req()
        .get('/api/data/export?entity=tasks&format=json')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: TASK_ID,
        title: 'My Task',
        status: TaskStatus.Todo,
        projectId: PROJECT_ID,
      });
    });

    it('returns 200 with JSON array when format=json and entity=projects', async () => {
      const projects = [makeProject()];
      projectRepo.find.mockResolvedValue(projects);

      const { body } = await req()
        .get('/api/data/export?entity=projects&format=json')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: PROJECT_ID,
        name: 'My Project',
        userId: TEST_USER_ID,
      });
    });

    it('returns 200 with CSV and Content-Disposition when format=csv', async () => {
      const tasks = [makeTask()];
      taskRepo.find.mockResolvedValue(tasks);

      const res = await req()
        .get('/api/data/export?entity=tasks&format=csv')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="tasks-export.csv"',
      );
      expect(res.text).toContain('id');
      expect(res.text).toContain('title');
      expect(res.text).toContain('My Task');
    });

    it('returns 200 with projects CSV and correct Content-Disposition', async () => {
      const projects = [makeProject()];
      projectRepo.find.mockResolvedValue(projects);

      const res = await req()
        .get('/api/data/export?entity=projects&format=csv')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="projects-export.csv"',
      );
    });

    it('uses default entity=tasks and format=csv when query params omitted', async () => {
      taskRepo.find.mockResolvedValue([]);

      const res = await req()
        .get('/api/data/export')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(taskRepo.find).toHaveBeenCalled();
    });

    it('returns 200 with empty array when no data', async () => {
      taskRepo.find.mockResolvedValue([]);

      const { body } = await req()
        .get('/api/data/export?entity=tasks&format=json')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body).toEqual([]);
    });
  });

  // ─── GET /api/data/report/summary ───────────────────────────────────────────

  describe('GET /api/data/report/summary', () => {
    it('returns 200 with { projects: { total }, tasks: { total, byStatus } }', async () => {
      projectRepo.count.mockResolvedValue(3);
      taskRepo.find.mockResolvedValue([
        makeTask({ status: TaskStatus.Todo }),
        makeTask({ id: 't2', status: TaskStatus.InProgress }),
        makeTask({ id: 't3', status: TaskStatus.Done }),
      ]);

      const { body } = await req()
        .get('/api/data/report/summary')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body).toMatchObject({
        projects: { total: 3 },
        tasks: {
          total: 3,
          byStatus: expect.objectContaining({
            [TaskStatus.Todo]: 1,
            [TaskStatus.InProgress]: 1,
            [TaskStatus.Done]: 1,
          }),
        },
      });
    });

    it('returns 200 with zeros when no projects or tasks', async () => {
      projectRepo.count.mockResolvedValue(0);
      taskRepo.find.mockResolvedValue([]);

      const { body } = await req()
        .get('/api/data/report/summary')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body.projects.total).toBe(0);
      expect(body.tasks.total).toBe(0);
      expect(body.tasks.byStatus[TaskStatus.Todo]).toBe(0);
      expect(body.tasks.byStatus[TaskStatus.InProgress]).toBe(0);
      expect(body.tasks.byStatus[TaskStatus.Done]).toBe(0);
    });
  });
});
