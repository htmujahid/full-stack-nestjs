import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Reflector, RouterModule } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { NoteController } from '../server/api/desk/note/note.controller';
import { NoteService } from '../server/api/desk/note/note.service';
import { Note } from '../server/api/desk/note/note.entity';
import { ProjectService } from '../server/api/desk/project/project.service';
import { Project } from '../server/api/desk/project/project.entity';
import { AuditService } from '../server/api/core/audit/audit.service';
import { UserRole } from '../server/api/identity/user/user-role.enum';
import { RolesGuard } from '../server/api/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/api/identity/rbac/permissions.guard';
import { mockRepository } from '../server/mocks/db.mock';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const NOTE_ID = '550e8400-e29b-41d4-a716-446655440003';

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

const makeNote = (overrides: Partial<Note> = {}): Note =>
  ({
    id: NOTE_ID,
    title: 'My Note',
    content: null,
    projectId: PROJECT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Note;

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Notes (e2e)', () => {
  let app: INestApplication;
  let noteRepo: ReturnType<typeof mockRepository> & {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    noteRepo = Object.assign(mockRepository(), {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    });
    qbMock = createQueryBuilderMock();
    noteRepo.createQueryBuilder.mockReturnValue(qbMock);

    projectRepo = Object.assign(mockRepository(), { findOneBy: jest.fn() });

    @Module({
      controllers: [NoteController],
      providers: [
        NoteService,
        ProjectService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Note), useValue: noteRepo },
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
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, RouterModule.register([{ path: 'api/notes', module: TestModule }])],
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

  describe('GET /api/notes', () => {
    it('returns 200 with paginated shape { data, total, page, limit }', async () => {
      const notes = [makeNote()];
      qbMock.getManyAndCount.mockResolvedValue([notes, 1]);

      const { body } = await request(app.getHttpServer())
        .get('/api/notes')
        .expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(body.data[0].title).toBe('My Note');
      expect(body.data[0].projectId).toBe(PROJECT_ID);
    });

    it('accepts projectId, search, sortBy, sortOrder, page, limit', async () => {
      const notes = [makeNote()];
      qbMock.getManyAndCount.mockResolvedValue([notes, 1]);

      const { body } = await request(app.getHttpServer())
        .get(
          `/api/notes?projectId=${PROJECT_ID}&search=meeting&sortBy=title&sortOrder=asc&page=2&limit=10`,
        )
        .expect(200);

      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
      expect(qbMock.andWhere).toHaveBeenCalled();
      expect(qbMock.orderBy).toHaveBeenCalledWith('note.title', 'ASC');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('returns 200 with note when found', async () => {
      const note = makeNote();
      noteRepo.findOne.mockResolvedValue(note);

      const { body } = await request(app.getHttpServer())
        .get(`/api/notes/${NOTE_ID}`)
        .expect(200);

      expect(body.id).toBe(NOTE_ID);
      expect(body.title).toBe('My Note');
    });

    it('returns 404 when note not found', async () => {
      noteRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/notes/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });

    it('returns 400 when id is not valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/notes/invalid')
        .expect(400);
    });
  });

  describe('POST /api/notes', () => {
    it('returns 201 with created note when user owns project', async () => {
      const project = makeProject();
      const created = makeNote({ title: 'New Note' });
      projectRepo.findOneBy.mockResolvedValue(project);
      noteRepo.create.mockReturnValue(created);
      noteRepo.save.mockResolvedValue(created);

      const { body } = await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'New Note', projectId: PROJECT_ID })
        .expect(201);

      expect(body.title).toBe('New Note');
      expect(body.projectId).toBe(PROJECT_ID);
    });

    it('returns 403 when user does not own project', async () => {
      const project = makeProject({ userId: OTHER_USER_ID });
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .post('/api/notes')
        .send({ title: 'New Note', projectId: PROJECT_ID })
        .expect(403);
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/notes')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /api/notes/:id', () => {
    it('returns 200 when user owns project', async () => {
      const note = makeNote();
      const project = makeProject();
      const updated = makeNote({ title: 'Updated' });
      noteRepo.findOne.mockResolvedValue(note);
      projectRepo.findOneBy.mockResolvedValue(project);
      noteRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Updated' })
        .expect(200);

      expect(body.title).toBe('Updated');
    });

    it('returns 403 when user does not own project', async () => {
      const note = makeNote();
      const project = makeProject({ userId: OTHER_USER_ID });
      noteRepo.findOne.mockResolvedValue(note);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .patch(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Updated' })
        .expect(403);
    });

    it('returns 404 when note not found', async () => {
      noteRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/api/notes/550e8400-e29b-41d4-a716-446655440099`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('returns 204 when user owns project', async () => {
      const note = makeNote();
      const project = makeProject();
      noteRepo.findOne.mockResolvedValue(note);
      projectRepo.findOneBy.mockResolvedValue(project);
      noteRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/notes/${NOTE_ID}`)
        .expect(204);

      expect(noteRepo.remove).toHaveBeenCalledWith(note);
    });

    it('returns 403 when user does not own project', async () => {
      const note = makeNote();
      const project = makeProject({ userId: OTHER_USER_ID });
      noteRepo.findOne.mockResolvedValue(note);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .delete(`/api/notes/${NOTE_ID}`)
        .expect(403);
    });

    it('returns 404 when note not found', async () => {
      noteRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/api/notes/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });
  });
});
