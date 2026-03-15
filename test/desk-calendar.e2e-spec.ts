import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { CalendarEventController } from '../server/modules/desk/calendar/calendar-event.controller';
import { CalendarEventService } from '../server/modules/desk/calendar/calendar-event.service';
import { CalendarEvent } from '../server/modules/desk/calendar/calendar-event.entity';
import { ProjectService } from '../server/modules/desk/project/project.service';
import { Project } from '../server/modules/desk/project/project.entity';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { mockRepository } from '../server/mocks/db.mock';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440003';

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

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: EVENT_ID,
    title: 'Team Meeting',
    description: null,
    startAt: new Date('2024-06-01T10:00:00Z'),
    endAt: new Date('2024-06-01T11:00:00Z'),
    allDay: false,
    projectId: PROJECT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CalendarEvent;

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Calendar events (e2e)', () => {
  let app: INestApplication;
  let eventRepo: ReturnType<typeof mockRepository> & {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    eventRepo = Object.assign(mockRepository(), {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    });
    qbMock = createQueryBuilderMock();
    eventRepo.createQueryBuilder.mockReturnValue(qbMock);

    projectRepo = Object.assign(mockRepository(), { findOneBy: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarEventController],
      providers: [
        CalendarEventService,
        ProjectService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(CalendarEvent), useValue: eventRepo },
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

  describe('GET /api/calendar-events', () => {
    it('returns 200 with paginated shape { data, total, page, limit }', async () => {
      const events = [makeEvent()];
      qbMock.getManyAndCount.mockResolvedValue([events, 1]);

      const { body } = await request(app.getHttpServer())
        .get('/api/calendar-events')
        .expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(body.data[0].title).toBe('Team Meeting');
      expect(body.data[0].projectId).toBe(PROJECT_ID);
    });

    it('accepts projectId, search, startFrom, endBefore, sortBy, page, limit', async () => {
      const events = [makeEvent()];
      qbMock.getManyAndCount.mockResolvedValue([events, 1]);

      const { body } = await request(app.getHttpServer())
        .get(
          `/api/calendar-events?projectId=${PROJECT_ID}&search=meeting&startFrom=2024-06-01&endBefore=2024-06-30&sortBy=startAt&sortOrder=asc&page=2&limit=10`,
        )
        .expect(200);

      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
      expect(qbMock.andWhere).toHaveBeenCalled();
      expect(qbMock.orderBy).toHaveBeenCalledWith('event.startAt', 'ASC');
    });
  });

  describe('GET /api/calendar-events/:id', () => {
    it('returns 200 with event when found', async () => {
      const event = makeEvent();
      eventRepo.findOne.mockResolvedValue(event);

      const { body } = await request(app.getHttpServer())
        .get(`/api/calendar-events/${EVENT_ID}`)
        .expect(200);

      expect(body.id).toBe(EVENT_ID);
      expect(body.title).toBe('Team Meeting');
    });

    it('returns 404 when event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/calendar-events/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });

    it('returns 400 when id is not valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/calendar-events/invalid')
        .expect(400);
    });
  });

  describe('POST /api/calendar-events', () => {
    it('returns 201 with created event when user owns project', async () => {
      const project = makeProject();
      const created = makeEvent({ title: 'New Event' });
      projectRepo.findOneBy.mockResolvedValue(project);
      eventRepo.create.mockReturnValue(created);
      eventRepo.save.mockResolvedValue(created);

      const { body } = await request(app.getHttpServer())
        .post('/api/calendar-events')
        .send({
          title: 'New Event',
          startAt: '2024-06-01T10:00:00Z',
          endAt: '2024-06-01T11:00:00Z',
          projectId: PROJECT_ID,
        })
        .expect(201);

      expect(body.title).toBe('New Event');
      expect(body.projectId).toBe(PROJECT_ID);
    });

    it('returns 403 when user does not own project', async () => {
      const project = makeProject({ userId: OTHER_USER_ID });
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .post('/api/calendar-events')
        .send({
          title: 'New Event',
          startAt: '2024-06-01T10:00:00Z',
          endAt: '2024-06-01T11:00:00Z',
          projectId: PROJECT_ID,
        })
        .expect(403);
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/calendar-events')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /api/calendar-events/:id', () => {
    it('returns 200 when user owns project', async () => {
      const event = makeEvent();
      const project = makeProject();
      const updated = makeEvent({ title: 'Updated' });
      eventRepo.findOne.mockResolvedValue(event);
      projectRepo.findOneBy.mockResolvedValue(project);
      eventRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/calendar-events/${EVENT_ID}`)
        .send({ title: 'Updated' })
        .expect(200);

      expect(body.title).toBe('Updated');
    });

    it('returns 403 when user does not own project', async () => {
      const event = makeEvent();
      const project = makeProject({ userId: OTHER_USER_ID });
      eventRepo.findOne.mockResolvedValue(event);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .patch(`/api/calendar-events/${EVENT_ID}`)
        .send({ title: 'Updated' })
        .expect(403);
    });

    it('returns 404 when event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/api/calendar-events/550e8400-e29b-41d4-a716-446655440099`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/calendar-events/:id', () => {
    it('returns 204 when user owns project', async () => {
      const event = makeEvent();
      const project = makeProject();
      eventRepo.findOne.mockResolvedValue(event);
      projectRepo.findOneBy.mockResolvedValue(project);
      eventRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/calendar-events/${EVENT_ID}`)
        .expect(204);

      expect(eventRepo.remove).toHaveBeenCalledWith(event);
    });

    it('returns 403 when user does not own project', async () => {
      const event = makeEvent();
      const project = makeProject({ userId: OTHER_USER_ID });
      eventRepo.findOne.mockResolvedValue(event);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .delete(`/api/calendar-events/${EVENT_ID}`)
        .expect(403);
    });

    it('returns 404 when event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/api/calendar-events/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });
  });
});
