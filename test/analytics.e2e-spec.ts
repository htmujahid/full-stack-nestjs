import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AnalyticsController } from '../server/modules/core/analytics/analytics.controller';
import { AnalyticsEvent } from '../server/modules/core/analytics/analytics-event.entity';
import { JwtAccessGuard } from '../server/modules/identity/auth/guards/jwt-access.guard';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { mockRepository } from '../server/mocks/db.mock';
import { Reflector } from '@nestjs/core';

const EVENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ID = 'session-123';
const TENANT_ID = '00000000-0000-4000-8000-000000000000';

const makeAnalyticsEvent = (
  overrides: Partial<AnalyticsEvent> = {},
): AnalyticsEvent =>
  ({
    id: EVENT_ID,
    event: 'page_view',
    properties: { path: '/dashboard' },
    actorId: ACTOR_ID,
    sessionId: SESSION_ID,
    tenantId: null,
    createdAt: new Date(),
    ...overrides,
  }) as AnalyticsEvent;

const testAuthGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const role = req.header('X-Test-Role') as UserRole | undefined;
    if (!role) throw new UnauthorizedException();
    req.user = { userId: 'test-user-id', role };
    return true;
  },
};

function createQueryBuilderMock() {
  return {
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let eventRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    eventRepo = mockRepository() as ReturnType<typeof mockRepository> & {
      createQueryBuilder: jest.Mock;
    };
    qbMock = createQueryBuilderMock();
    eventRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        RolesGuard,
        PermissionsGuard,
        Reflector,
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: eventRepo,
        },
      ],
    })
      .overrideGuard(JwtAccessGuard)
      .useValue(testAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    qbMock.getManyAndCount.mockResolvedValue([[], 0]);
  });

  const req = () => request(app.getHttpServer());
  const base = '/api/analytics/events';
  const asAdmin = {
    get: (path: string) => req().get(path).set('X-Test-Role', UserRole.Admin),
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
      await req().get(base).expect(401);
    });

    it('returns 403 when authenticated but not Admin/SuperAdmin', async () => {
      await asMember.get(base).expect(403);
    });
  });

  // ─── GET /api/analytics/events ─────────────────────────────────────────────

  describe('GET /api/analytics/events', () => {
    it('returns 200 with paginated events when Admin', async () => {
      const events = [
        makeAnalyticsEvent(),
        makeAnalyticsEvent({
          id: 'event-2',
          event: 'button_click',
          properties: { button: 'submit' },
        }),
      ];
      qbMock.getManyAndCount.mockResolvedValue([events, events.length]);

      const { body } = await asAdmin.get(base).expect(200);

      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.items[0].event).toBe('page_view');
      expect(body.items[0].properties).toEqual({ path: '/dashboard' });
      expect(body.items[1].event).toBe('button_click');
    });

    it('returns 200 with paginated events when SuperAdmin', async () => {
      const events = [makeAnalyticsEvent()];
      qbMock.getManyAndCount.mockResolvedValue([events, events.length]);

      const { body } = await asSuperAdmin.get(base).expect(200);

      expect(body.items).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(EVENT_ID);
    });

    it('returns 200 with empty items when no events', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      const { body } = await asAdmin.get(base).expect(200);

      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('supports query params: limit and offset', async () => {
      const events = [makeAnalyticsEvent()];
      qbMock.getManyAndCount.mockResolvedValue([events, 1]);

      const { body } = await asAdmin
        .get(`${base}?limit=20&offset=10`)
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(qbMock.take).toHaveBeenCalledWith(20);
      expect(qbMock.skip).toHaveBeenCalledWith(10);
    });

    it('supports query params: event only', async () => {
      const events = [makeAnalyticsEvent({ event: 'pageview' })];
      qbMock.getManyAndCount.mockResolvedValue([events, 1]);

      const { body } = await asAdmin
        .get(`${base}?event=pageview`)
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'e.event = :event',
        expect.objectContaining({ event: 'pageview' }),
      );
    });

    it('supports query params: actorId, sessionId, tenantId, from, to', async () => {
      const events = [makeAnalyticsEvent({ actorId: ACTOR_ID })];
      qbMock.getManyAndCount.mockResolvedValue([events, 1]);

      const { body } = await asAdmin
        .get(
          `${base}?actorId=${ACTOR_ID}&sessionId=${SESSION_ID}&tenantId=${TENANT_ID}&from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z`,
        )
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'e.actorId = :actorId',
        expect.objectContaining({ actorId: ACTOR_ID }),
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'e.createdAt >= :from',
        expect.objectContaining({ from: expect.any(Date) }),
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'e.createdAt <= :to',
        expect.objectContaining({ to: expect.any(Date) }),
      );
    });

    it('returns 400 when actorId is not a valid UUID', async () => {
      const { body } = await asAdmin
        .get(`${base}?actorId=invalid`)
        .expect(400);

      expect(body.message).toBeDefined();
    });

    it('returns 400 when tenantId is not a valid UUID', async () => {
      const { body } = await asAdmin
        .get(`${base}?tenantId=invalid`)
        .expect(400);

      expect(body.message).toBeDefined();
    });
  });
});
