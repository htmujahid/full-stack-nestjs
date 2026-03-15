import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { of } from 'rxjs';
import { NotificationController } from '../server/modules/misc/notification/notification.controller';
import { NotificationService } from '../server/modules/misc/notification/notification.service';
import { NotificationStreamService } from '../server/modules/misc/notification/notification-stream.service';
import { Notification } from '../server/modules/misc/notification/notification.entity';
import { TeamMember } from '../server/modules/identity/team/team-member.entity';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { mockRepository } from '../server/mocks/db.mock';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GROUP_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOTIFICATION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OTHER_USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeNotification = (
  overrides: Partial<Notification> = {},
): Notification =>
  ({
    id: NOTIFICATION_ID,
    userId: TEST_USER_ID,
    groupId: null,
    type: 'info',
    title: 'Test notification',
    body: null,
    read: false,
    metadata: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }) as Notification;

const makeTeamMember = (
  overrides: Partial<TeamMember> = {},
): TeamMember =>
  ({
    id: 'member-id',
    teamId: GROUP_ID,
    userId: TEST_USER_ID,
    joinedAt: new Date(),
    ...overrides,
  }) as TeamMember;

// ─── Suite ────────────────────────────────────────────────────────────────────

const mockStreamService = {
  getOrCreateStream: jest.fn().mockReturnValue(of({ data: {} })),
  push: jest.fn(),
  pushToMany: jest.fn(),
  disconnect: jest.fn(),
};

describe('Notification (e2e)', () => {
  let app: INestApplication;
  let notificationRepo: ReturnType<typeof mockRepository>;
  let teamMemberRepo: ReturnType<typeof mockRepository>;

  beforeAll(async () => {
    notificationRepo = mockRepository();
    teamMemberRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: NotificationStreamService, useValue: mockStreamService },
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: teamMemberRepo,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.use(
      (
        req: {
          user?: { userId: string; role: UserRole };
          header: (n: string) => string;
        },
        res: { status: (n: number) => { json: (o: object) => void } },
        next: () => void,
      ) => {
        const role = req.header('X-Test-Role') as UserRole | undefined;
        if (!role) {
          return res.status(401).json({
            statusCode: 401,
            message: 'Unauthorized',
          });
        }
        req.user = { userId: TEST_USER_ID, role };
        next();
      },
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  const req = () => request(app.getHttpServer());

  // ─── Auth ───────────────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('returns 401 when unauthenticated on GET /api/notifications', async () => {
      await req().get('/api/notifications').expect(401);
    });

    it('returns 401 when unauthenticated on POST /api/notifications', async () => {
      await req()
        .post('/api/notifications')
        .send({ type: 'info', title: 'Test' })
        .expect(401);
    });

    it('returns 401 when unauthenticated on GET /api/notifications/stream', async () => {
      await req().get('/api/notifications/stream').expect(401);
    });

    it('returns 403 when authenticated as Admin without project:read', async () => {
      await req()
        .get('/api/notifications')
        .set('X-Test-Role', UserRole.Admin)
        .expect(403);
    });
  });

  // ─── GET /api/notifications/stream ───────────────────────────────────────────

  describe('GET /api/notifications/stream', () => {
    it('returns 200 and accepts SSE connection with text/event-stream', async () => {
      const res = await req()
        .get('/api/notifications/stream')
        .set('X-Test-Role', UserRole.Member)
        .set('Accept', 'text/event-stream')
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    });
  });

  // ─── POST /api/notifications ─────────────────────────────────────────────────

  describe('POST /api/notifications', () => {
    it('returns 201 with created notification', async () => {
      const created = makeNotification({
        type: 'alert',
        title: 'New alert',
        body: 'Details here',
        metadata: { key: 'value' },
      });
      notificationRepo.create.mockImplementation((dto) => dto as Notification);
      notificationRepo.save.mockResolvedValue(created);

      const { body } = await req()
        .post('/api/notifications')
        .set('X-Test-Role', UserRole.Member)
        .send({
          type: 'alert',
          title: 'New alert',
          body: 'Details here',
          metadata: { key: 'value' },
        })
        .expect(201);

      expect(body).toMatchObject({
        id: NOTIFICATION_ID,
        type: 'alert',
        title: 'New alert',
        body: 'Details here',
        metadata: { key: 'value' },
      });
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('returns 400 when body is empty', async () => {
      await req()
        .post('/api/notifications')
        .set('X-Test-Role', UserRole.Member)
        .send({})
        .expect(400);
    });

    it('returns 400 when type is missing', async () => {
      await req()
        .post('/api/notifications')
        .set('X-Test-Role', UserRole.Member)
        .send({ title: 'Test' })
        .expect(400);
    });

    it('returns 400 when title is missing', async () => {
      await req()
        .post('/api/notifications')
        .set('X-Test-Role', UserRole.Member)
        .send({ type: 'info' })
        .expect(400);
    });
  });

  // ─── GET /api/notifications ──────────────────────────────────────────────────

  describe('GET /api/notifications', () => {
    it('returns 200 with paginated notifications', async () => {
      const notifications = [makeNotification(), makeNotification({ id: 'n2' })];
      notificationRepo.find.mockResolvedValue(notifications);
      notificationRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const { body } = await req()
        .get('/api/notifications')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 2,
        page: 1,
        limit: 20,
        unreadCount: 1,
      });
      expect(body.data).toHaveLength(2);
    });

    it('returns 200 with page and limit query params', async () => {
      notificationRepo.find.mockResolvedValue([]);
      notificationRepo.count.mockResolvedValue(0);

      const { body } = await req()
        .get('/api/notifications?page=2&limit=10')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
      expect(notificationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ─── POST /api/notifications/group/:groupId ──────────────────────────────────

  describe('POST /api/notifications/group/:groupId', () => {
    it('returns 201 with notifications for all team members', async () => {
      const members = [
        makeTeamMember({ userId: TEST_USER_ID }),
        makeTeamMember({ userId: OTHER_USER_ID, id: 'm2' }),
      ];
      teamMemberRepo.find.mockResolvedValue(members);

      const n1 = makeNotification({
        userId: TEST_USER_ID,
        groupId: GROUP_ID,
        type: 'team',
        title: 'Team update',
      });
      const n2 = makeNotification({
        id: 'n2',
        userId: OTHER_USER_ID,
        groupId: GROUP_ID,
        type: 'team',
        title: 'Team update',
      });
      notificationRepo.create.mockImplementation((dto) => dto as Notification);
      notificationRepo.save
        .mockResolvedValueOnce(n1)
        .mockResolvedValueOnce(n2);

      const { body } = await req()
        .post(`/api/notifications/group/${GROUP_ID}`)
        .set('X-Test-Role', UserRole.Member)
        .send({ type: 'team', title: 'Team update' })
        .expect(201);

      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        userId: TEST_USER_ID,
        groupId: GROUP_ID,
        type: 'team',
        title: 'Team update',
      });
      expect(body[1]).toMatchObject({
        userId: OTHER_USER_ID,
        groupId: GROUP_ID,
      });
      expect(teamMemberRepo.find).toHaveBeenCalledWith({
        where: { teamId: GROUP_ID },
        select: ['userId'],
      });
    });

    it('returns 201 with empty array when group has no members', async () => {
      teamMemberRepo.find.mockResolvedValue([]);

      const { body } = await req()
        .post(`/api/notifications/group/${GROUP_ID}`)
        .set('X-Test-Role', UserRole.Member)
        .send({ type: 'team', title: 'Empty team' })
        .expect(201);

      expect(body).toHaveLength(0);
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('returns 400 when groupId is invalid UUID', async () => {
      await req()
        .post('/api/notifications/group/not-a-uuid')
        .set('X-Test-Role', UserRole.Member)
        .send({ type: 'team', title: 'Test' })
        .expect(400);
    });
  });

  // ─── PATCH /api/notifications/:id/read ───────────────────────────────────────

  describe('PATCH /api/notifications/:id/read', () => {
    it('returns 200 with marked notification', async () => {
      const updated = makeNotification({ id: NOTIFICATION_ID, read: true });
      notificationRepo.findOne.mockResolvedValue(makeNotification());
      notificationRepo.save.mockResolvedValue(updated);

      const { body } = await req()
        .patch(`/api/notifications/${NOTIFICATION_ID}/read`)
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(body.read).toBe(true);
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ read: true }),
      );
    });

    it('returns 404 when notification not found', async () => {
      notificationRepo.findOne.mockResolvedValue(null);

      await req()
        .patch(`/api/notifications/${NOTIFICATION_ID}/read`)
        .set('X-Test-Role', UserRole.Member)
        .expect(404);
    });

    it('returns 400 when id is invalid UUID', async () => {
      await req()
        .patch('/api/notifications/bad-id/read')
        .set('X-Test-Role', UserRole.Member)
        .expect(400);
    });
  });

  // ─── PATCH /api/notifications/read-all ───────────────────────────────────────

  describe('PATCH /api/notifications/read-all', () => {
    it('returns 200 and marks all read', async () => {
      notificationRepo.update.mockResolvedValue({ affected: 3 });

      await req()
        .patch('/api/notifications/read-all')
        .set('X-Test-Role', UserRole.Member)
        .expect(200);

      expect(notificationRepo.update).toHaveBeenCalledWith(
        { userId: TEST_USER_ID, read: false },
        { read: true },
      );
    });
  });
});
