import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { TeamController } from '../server/modules/identity/team/team.controller';
import { TeamService } from '../server/modules/identity/team/team.service';
import { Team } from '../server/modules/identity/team/team.entity';
import { TeamMember } from '../server/modules/identity/team/team-member.entity';
import { TeamMemberRole } from '../server/modules/identity/team/team-member-role.enum';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { mockRepository } from '../server/mocks/db.mock';

const TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const makeTeam = (overrides: Partial<Team> = {}): Team =>
  ({
    id: TEAM_ID,
    name: 'Test Team',
    description: 'A test team',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Team;

const makeMember = (overrides: Partial<TeamMember> = {}): TeamMember =>
  ({
    id: MEMBER_ID,
    teamId: TEAM_ID,
    userId: USER_ID,
    role: TeamMemberRole.Member,
    joinedAt: new Date(),
    ...overrides,
  }) as TeamMember;

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
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Team (e2e)', () => {
  let app: INestApplication;
  let teamRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let memberRepo: ReturnType<typeof mockRepository>;
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    teamRepo = mockRepository() as ReturnType<typeof mockRepository> & {
      createQueryBuilder: jest.Mock;
    };
    qbMock = createQueryBuilderMock();
    teamRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    memberRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        TeamService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Team), useValue: teamRepo },
        { provide: getRepositoryToken(TeamMember), useValue: memberRepo },
        { provide: APP_GUARD, useValue: testAuthGuard },
      ],
    }).compile();

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
  const base = '/api/identity/teams';
  const asAdmin = {
    get: (path: string) => req().get(path).set('X-Test-Role', UserRole.Admin),
    post: (path: string) =>
      req().post(path).set('X-Test-Role', UserRole.Admin),
    patch: (path: string) =>
      req().patch(path).set('X-Test-Role', UserRole.Admin),
    delete: (path: string) =>
      req().delete(path).set('X-Test-Role', UserRole.Admin),
  };
  const asSuperAdmin = {
    get: (path: string) =>
      req().get(path).set('X-Test-Role', UserRole.SuperAdmin),
    post: (path: string) =>
      req().post(path).set('X-Test-Role', UserRole.SuperAdmin),
    patch: (path: string) =>
      req().patch(path).set('X-Test-Role', UserRole.SuperAdmin),
    delete: (path: string) =>
      req().delete(path).set('X-Test-Role', UserRole.SuperAdmin),
  };
  const asMember = {
    get: (path: string) => req().get(path).set('X-Test-Role', UserRole.Member),
  };

  // ─── Auth ──────────────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('returns 401 when unauthenticated', async () => {
      await req().get(base).expect(401);
    });

    it('returns 403 when Member tries team routes', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await asMember.get(base).expect(403);
    });
  });

  // ─── GET /api/identity/teams ─────────────────────────────────────────────────

  describe('GET /api/identity/teams', () => {
    it('returns 200 with list shape { data, total, page, limit }', async () => {
      const teams = [makeTeam(), makeTeam({ id: 'team-2', name: 'Other' })];
      qbMock.getManyAndCount.mockResolvedValue([teams, 2]);

      const { body } = await asAdmin.get(base).expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 2,
        page: 1,
        limit: 20,
      });
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBe('Test Team');
      expect(body.data[1].name).toBe('Other');
    });

    it('returns 200 with empty data when no teams', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      const { body } = await asAdmin.get(base).expect(200);

      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  // ─── GET /api/identity/teams/:id ────────────────────────────────────────────

  describe('GET /api/identity/teams/:id', () => {
    it('returns 200 with team when Admin', async () => {
      const team = makeTeam();
      teamRepo.findOne.mockResolvedValue(team);

      const { body } = await asAdmin.get(`${base}/${TEAM_ID}`).expect(200);

      expect(body.id).toBe(TEAM_ID);
      expect(body.name).toBe('Test Team');
      expect(body.description).toBe('A test team');
    });

    it('returns 404 when team not found', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await asAdmin
        .get(`${base}/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await asAdmin.get(`${base}/invalid-id`).expect(400);
    });
  });

  // ─── POST /api/identity/teams ───────────────────────────────────────────────

  describe('POST /api/identity/teams', () => {
    it('returns 201 with created team when Admin', async () => {
      const created = makeTeam({
        id: 'new-team-id',
        name: 'New Team',
        description: 'New desc',
      });
      teamRepo.create.mockReturnValue(created);
      teamRepo.save.mockResolvedValue(created);

      const { body } = await asAdmin
        .post(base)
        .send({ name: 'New Team', description: 'New desc' })
        .expect(201);

      expect(body.id).toBe('new-team-id');
      expect(body.name).toBe('New Team');
      expect(body.description).toBe('New desc');
    });

    it('returns 201 with optional description omitted', async () => {
      const created = makeTeam({ id: 'new-id', name: 'Minimal', description: null });
      teamRepo.create.mockReturnValue(created);
      teamRepo.save.mockResolvedValue(created);

      const { body } = await asAdmin.post(base).send({ name: 'Minimal' }).expect(201);

      expect(body.name).toBe('Minimal');
    });

    it('returns 400 when body is invalid', async () => {
      await asAdmin.post(base).send({}).expect(400);
    });

    it('returns 400 when name is empty', async () => {
      await asAdmin.post(base).send({ name: '' }).expect(400);
    });
  });

  // ─── PATCH /api/identity/teams/:id ──────────────────────────────────────────

  describe('PATCH /api/identity/teams/:id', () => {
    it('returns 200 with updated team when Admin', async () => {
      const existing = makeTeam();
      const updated = makeTeam({ ...existing, name: 'Updated Name' });
      teamRepo.findOne.mockResolvedValue(existing);
      teamRepo.save.mockResolvedValue(updated);

      const { body } = await asAdmin
        .patch(`${base}/${TEAM_ID}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(body.name).toBe('Updated Name');
    });

    it('returns 404 when team not found', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await asAdmin
        .patch(`${base}/00000000-0000-0000-0000-000000000000`)
        .send({ name: 'New' })
        .expect(404);
    });
  });

  // ─── DELETE /api/identity/teams/:id ─────────────────────────────────────────

  describe('DELETE /api/identity/teams/:id', () => {
    it('returns 204 when Admin', async () => {
      const team = makeTeam();
      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.remove.mockResolvedValue(team);

      await asAdmin.delete(`${base}/${TEAM_ID}`).expect(204);

      expect(teamRepo.remove).toHaveBeenCalledWith(team);
    });

    it('returns 404 when team not found', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await asAdmin
        .delete(`${base}/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });
  });

  // ─── POST /api/identity/teams/:id/members ───────────────────────────────────

  describe('POST /api/identity/teams/:id/members', () => {
    it('returns 201 with member when Admin', async () => {
      const team = makeTeam();
      const member = makeMember();
      teamRepo.findOne.mockResolvedValue(team);
      memberRepo.findOneBy.mockResolvedValue(null);
      memberRepo.create.mockReturnValue(member);
      memberRepo.save.mockResolvedValue(member);
      memberRepo.findOneOrFail.mockResolvedValue(member);

      const { body } = await asAdmin
        .post(`${base}/${TEAM_ID}/members`)
        .send({ userId: USER_ID })
        .expect(201);

      expect(body.userId).toBe(USER_ID);
      expect(body.teamId).toBe(TEAM_ID);
      expect(body.role).toBe(TeamMemberRole.Member);
    });

    it('returns 201 with custom role', async () => {
      const team = makeTeam();
      const member = makeMember({ role: TeamMemberRole.Admin });
      teamRepo.findOne.mockResolvedValue(team);
      memberRepo.findOneBy.mockResolvedValue(null);
      memberRepo.create.mockReturnValue(member);
      memberRepo.save.mockResolvedValue(member);
      memberRepo.findOneOrFail.mockResolvedValue(member);

      const { body } = await asAdmin
        .post(`${base}/${TEAM_ID}/members`)
        .send({ userId: USER_ID, role: TeamMemberRole.Admin })
        .expect(201);

      expect(body.role).toBe(TeamMemberRole.Admin);
    });

    it('returns 400 when body is invalid', async () => {
      const { body } = await asAdmin
        .post(`${base}/${TEAM_ID}/members`)
        .send({})
        .expect(400);
      expect(body.message).toBeDefined();
    });

    it('returns 409 when user already a member', async () => {
      const team = makeTeam();
      const existing = makeMember();
      teamRepo.findOne.mockResolvedValue(team);
      memberRepo.findOneBy.mockResolvedValue(existing);

      const { body } = await asAdmin
        .post(`${base}/${TEAM_ID}/members`)
        .send({ userId: USER_ID })
        .expect(409);

      expect(body.message).toMatch(/already a member/i);
    });
  });

  // ─── DELETE /api/identity/teams/:id/members/:userId ─────────────────────────

  describe('DELETE /api/identity/teams/:id/members/:userId', () => {
    it('returns 204 when Admin', async () => {
      const member = makeMember();
      memberRepo.findOneBy.mockResolvedValue(member);
      memberRepo.remove.mockResolvedValue(member);

      await asAdmin
        .delete(`${base}/${TEAM_ID}/members/${USER_ID}`)
        .expect(204);

      expect(memberRepo.remove).toHaveBeenCalledWith(member);
    });

    it('returns 404 when member not found', async () => {
      memberRepo.findOneBy.mockResolvedValue(null);

      await asAdmin
        .delete(`${base}/${TEAM_ID}/members/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });
  });

  // ─── PATCH /api/identity/teams/:id/members/:userId ──────────────────────────

  describe('PATCH /api/identity/teams/:id/members/:userId', () => {
    it('returns 200 with updated role when Admin', async () => {
      const member = makeMember();
      const updated = makeMember({ ...member, role: TeamMemberRole.Admin });
      memberRepo.findOneBy.mockResolvedValue(member);
      memberRepo.save.mockResolvedValue(updated);

      const { body } = await asAdmin
        .patch(`${base}/${TEAM_ID}/members/${USER_ID}`)
        .send({ role: TeamMemberRole.Admin })
        .expect(200);

      expect(body.role).toBe(TeamMemberRole.Admin);
    });

    it('returns 404 when member not found', async () => {
      memberRepo.findOneBy.mockResolvedValue(null);

      await asAdmin
        .patch(`${base}/${TEAM_ID}/members/00000000-0000-0000-0000-000000000000`)
        .send({ role: TeamMemberRole.Admin })
        .expect(404);
    });
  });
});
