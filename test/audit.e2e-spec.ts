import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuditController } from '../server/modules/core/audit/audit.controller';
import { AuditService } from '../server/modules/core/audit/audit.service';
import { AuditLog, AuditAction } from '../server/modules/core/audit/audit.entity';
import { AUDIT_SINKS } from '../server/modules/core/audit/audit.service';
import { JwtAccessGuard } from '../server/modules/identity/auth/guards/jwt-access.guard';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { mockRepository } from '../server/mocks/db.mock';
import { Reflector } from '@nestjs/core';

const LOG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RESOURCE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TENANT_ID = '00000000-0000-4000-8000-000000000000';

const makeAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog =>
  ({
    id: LOG_ID,
    actorId: ACTOR_ID,
    action: AuditAction.Create,
    resourceType: 'User',
    resourceId: RESOURCE_ID,
    oldValue: null,
    newValue: { name: 'Test' },
    metadata: null,
    ip: null,
    userAgent: null,
    tenantId: null,
    createdAt: new Date(),
    ...overrides,
  }) as AuditLog;

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

describe('Audit (e2e)', () => {
  let app: INestApplication;
  let auditRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    auditRepo = mockRepository() as ReturnType<typeof mockRepository> & {
      createQueryBuilder: jest.Mock;
    };
    qbMock = createQueryBuilderMock();
    auditRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        AuditService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: AUDIT_SINKS, useValue: [] },
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
  const base = '/api/audit';
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

  // ─── GET /api/audit ────────────────────────────────────────────────────────

  describe('GET /api/audit', () => {
    it('returns 200 with paginated audit logs when Admin', async () => {
      const logs = [
        makeAuditLog(),
        makeAuditLog({
          id: 'log-2',
          action: AuditAction.Update,
          resourceType: 'Team',
        }),
      ];
      qbMock.getManyAndCount.mockResolvedValue([logs, logs.length]);

      const { body } = await asAdmin.get(base).expect(200);

      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.items[0].action).toBe(AuditAction.Create);
      expect(body.items[0].resourceType).toBe('User');
      expect(body.items[1].action).toBe(AuditAction.Update);
      expect(body.items[1].resourceType).toBe('Team');
    });

    it('returns 200 with paginated audit logs when SuperAdmin', async () => {
      const logs = [makeAuditLog()];
      qbMock.getManyAndCount.mockResolvedValue([logs, logs.length]);

      const { body } = await asSuperAdmin.get(base).expect(200);

      expect(body.items).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.items[0].id).toBe(LOG_ID);
    });

    it('returns 200 with empty items when no logs', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      const { body } = await asAdmin.get(base).expect(200);

      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('supports query params: limit and offset', async () => {
      const logs = [makeAuditLog()];
      qbMock.getManyAndCount.mockResolvedValue([logs, 1]);

      const { body } = await asAdmin
        .get(`${base}?limit=10&offset=5`)
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(qbMock.take).toHaveBeenCalledWith(10);
      expect(qbMock.skip).toHaveBeenCalledWith(5);
    });

    it('supports query params: actorId only', async () => {
      const logs = [makeAuditLog({ actorId: ACTOR_ID })];
      qbMock.getManyAndCount.mockResolvedValue([logs, 1]);

      const { body } = await asAdmin
        .get(`${base}?actorId=${ACTOR_ID}`)
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'a.actorId = :actorId',
        expect.objectContaining({ actorId: ACTOR_ID }),
      );
    });

    it('supports query params: action, resourceType, resourceId, tenantId, from, to', async () => {
      const logs = [makeAuditLog()];
      qbMock.getManyAndCount.mockResolvedValue([logs, 1]);

      const { body } = await asAdmin
        .get(
          `${base}?action=create&resourceType=User&resourceId=${RESOURCE_ID}&tenantId=${TENANT_ID}&from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z`,
        )
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'a.action = :action',
        expect.objectContaining({ action: 'create' }),
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'a.createdAt >= :from',
        expect.objectContaining({ from: expect.any(Date) }),
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'a.createdAt <= :to',
        expect.objectContaining({ to: expect.any(Date) }),
      );
    });

    it('returns 400 when actorId is not a valid UUID', async () => {
      const { body } = await asAdmin
        .get(`${base}?actorId=invalid`)
        .expect(400);

      expect(body.message).toBeDefined();
    });

    it('returns 400 when action is invalid', async () => {
      const { body } = await asAdmin
        .get(`${base}?action=invalid-action`)
        .expect(400);

      expect(body.message).toBeDefined();
    });
  });
});
