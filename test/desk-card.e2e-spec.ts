import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { CardController } from '../server/modules/desk/card/card.controller';
import { CardService } from '../server/modules/desk/card/card.service';
import { Card } from '../server/modules/desk/card/card.entity';
import { ProjectService } from '../server/modules/desk/project/project.service';
import { Project } from '../server/modules/desk/project/project.entity';
import { UserRole } from '../server/modules/identity/user/user-role.enum';
import { RolesGuard } from '../server/modules/identity/rbac/roles.guard';
import { PermissionsGuard } from '../server/modules/identity/rbac/permissions.guard';
import { mockRepository } from '../server/mocks/db.mock';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440002';
const CARD_ID = '550e8400-e29b-41d4-a716-446655440003';

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

const makeCard = (overrides: Partial<Card> = {}): Card =>
  ({
    id: CARD_ID,
    title: 'My Card',
    description: null,
    projectId: PROJECT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Card;

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('Cards (e2e)', () => {
  let app: INestApplication;
  let cardRepo: ReturnType<typeof mockRepository> & {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let projectRepo: ReturnType<typeof mockRepository> & {
    findOneBy: jest.Mock;
  };
  let qbMock: ReturnType<typeof createQueryBuilderMock>;

  beforeAll(async () => {
    cardRepo = Object.assign(mockRepository(), {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    });
    qbMock = createQueryBuilderMock();
    cardRepo.createQueryBuilder.mockReturnValue(qbMock);

    projectRepo = Object.assign(mockRepository(), { findOneBy: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardController],
      providers: [
        CardService,
        ProjectService,
        RolesGuard,
        PermissionsGuard,
        Reflector,
        { provide: getRepositoryToken(Card), useValue: cardRepo },
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

  describe('GET /api/cards', () => {
    it('returns 200 with paginated shape { data, total, page, limit }', async () => {
      const cards = [makeCard()];
      qbMock.getManyAndCount.mockResolvedValue([cards, 1]);

      const { body } = await request(app.getHttpServer())
        .get('/api/cards')
        .expect(200);

      expect(body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(body.data[0].title).toBe('My Card');
      expect(body.data[0].projectId).toBe(PROJECT_ID);
    });

    it('accepts projectId, search, sortBy, sortOrder, page, limit', async () => {
      const cards = [makeCard()];
      qbMock.getManyAndCount.mockResolvedValue([cards, 1]);

      const { body } = await request(app.getHttpServer())
        .get(
          `/api/cards?projectId=${PROJECT_ID}&search=meeting&sortBy=title&sortOrder=asc&page=2&limit=10`,
        )
        .expect(200);

      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
      expect(qbMock.andWhere).toHaveBeenCalled();
      expect(qbMock.orderBy).toHaveBeenCalledWith('card.title', 'ASC');
    });
  });

  describe('GET /api/cards/:id', () => {
    it('returns 200 with card when found', async () => {
      const card = makeCard();
      cardRepo.findOne.mockResolvedValue(card);

      const { body } = await request(app.getHttpServer())
        .get(`/api/cards/${CARD_ID}`)
        .expect(200);

      expect(body.id).toBe(CARD_ID);
      expect(body.title).toBe('My Card');
    });

    it('returns 404 when card not found', async () => {
      cardRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/cards/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });

    it('returns 400 when id is not valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/cards/invalid')
        .expect(400);
    });
  });

  describe('POST /api/cards', () => {
    it('returns 201 with created card when user owns project', async () => {
      const project = makeProject();
      const created = makeCard({ title: 'New Card' });
      projectRepo.findOneBy.mockResolvedValue(project);
      cardRepo.create.mockReturnValue(created);
      cardRepo.save.mockResolvedValue(created);

      const { body } = await request(app.getHttpServer())
        .post('/api/cards')
        .send({ title: 'New Card', projectId: PROJECT_ID })
        .expect(201);

      expect(body.title).toBe('New Card');
      expect(body.projectId).toBe(PROJECT_ID);
    });

    it('returns 403 when user does not own project', async () => {
      const project = makeProject({ userId: OTHER_USER_ID });
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .post('/api/cards')
        .send({ title: 'New Card', projectId: PROJECT_ID })
        .expect(403);
    });

    it('returns 400 when body is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/cards')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /api/cards/:id', () => {
    it('returns 200 when user owns project', async () => {
      const card = makeCard();
      const project = makeProject();
      const updated = makeCard({ title: 'Updated' });
      cardRepo.findOne.mockResolvedValue(card);
      projectRepo.findOneBy.mockResolvedValue(project);
      cardRepo.save.mockResolvedValue(updated);

      const { body } = await request(app.getHttpServer())
        .patch(`/api/cards/${CARD_ID}`)
        .send({ title: 'Updated' })
        .expect(200);

      expect(body.title).toBe('Updated');
    });

    it('returns 403 when user does not own project', async () => {
      const card = makeCard();
      const project = makeProject({ userId: OTHER_USER_ID });
      cardRepo.findOne.mockResolvedValue(card);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .patch(`/api/cards/${CARD_ID}`)
        .send({ title: 'Updated' })
        .expect(403);
    });

    it('returns 404 when card not found', async () => {
      cardRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/api/cards/550e8400-e29b-41d4-a716-446655440099`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/cards/:id', () => {
    it('returns 204 when user owns project', async () => {
      const card = makeCard();
      const project = makeProject();
      cardRepo.findOne.mockResolvedValue(card);
      projectRepo.findOneBy.mockResolvedValue(project);
      cardRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/cards/${CARD_ID}`)
        .expect(204);

      expect(cardRepo.remove).toHaveBeenCalledWith(card);
    });

    it('returns 403 when user does not own project', async () => {
      const card = makeCard();
      const project = makeProject({ userId: OTHER_USER_ID });
      cardRepo.findOne.mockResolvedValue(card);
      projectRepo.findOneBy.mockResolvedValue(project);

      await request(app.getHttpServer())
        .delete(`/api/cards/${CARD_ID}`)
        .expect(403);
    });

    it('returns 404 when card not found', async () => {
      cardRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/api/cards/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });
  });
});
