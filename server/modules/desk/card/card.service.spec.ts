import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CardService } from './card.service';
import { Card } from './card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { FindCardsDto } from './dto/find-cards.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeCard = (overrides: Partial<Card> = {}): Card =>
  ({
    id: 'card-1',
    title: 'Test Card',
    description: null,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Card;

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'project-1',
  userId: 'user-1',
  ...overrides,
});

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

const auth = { userId: 'user-1', role: UserRole.Member } as const;

describe('CardService', () => {
  let service: CardService;
  let cardRepo: ReturnType<typeof mockRepository> & { createQueryBuilder: jest.Mock };
  let projectService: { findOne: jest.Mock };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    cardRepo = {
      ...mockRepository(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    cardRepo.createQueryBuilder.mockReturnValue(qb);

    projectService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        { provide: getRepositoryToken(Card), useValue: cardRepo },
        { provide: ProjectService, useValue: projectService },
      ],
    }).compile();

    service = module.get(CardService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns CardsPage with data, total, page, limit', async () => {
      const cards = [makeCard(), makeCard({ id: 'card-2', title: 'Second' })];
      qb.getManyAndCount.mockResolvedValue([cards, 2]);

      const dto: FindCardsDto = {};
      const result = await service.findAll(dto, auth);

      expect(cardRepo.createQueryBuilder).toHaveBeenCalledWith('card');
      expect(qb.orderBy).toHaveBeenCalledWith('card.createdAt', 'DESC');
      expect(result).toEqual({ data: cards, total: 2, page: 1, limit: 20 });
    });

    it('adds andWhere for search and projectId', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'meeting', projectId: 'proj-1' }, auth);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(card.title LIKE :search OR card.description LIKE :search)',
        { search: '%meeting%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'card.projectId = :projectId',
        { projectId: 'proj-1' },
      );
    });

    it('applies pagination and sortBy', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { page: 2, limit: 10, sortBy: 'title', sortOrder: 'asc' },
        auth,
      );

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.orderBy).toHaveBeenCalledWith('card.title', 'ASC');
    });
  });

  describe('findOne', () => {
    it('returns card when found', async () => {
      const card = makeCard();
      cardRepo.findOne.mockResolvedValue(card);

      const result = await service.findOne('card-1');

      expect(cardRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        relations: { project: true },
      });
      expect(result).toBe(card);
    });

    it('throws NotFoundException when not found', async () => {
      cardRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates card when user owns project', async () => {
      const dto: CreateCardDto = { title: 'New Card', projectId: 'project-1' };
      const project = makeProject({ userId: 'user-1' });
      const created = makeCard({ title: 'New Card' });

      projectService.findOne.mockResolvedValue(project);
      cardRepo.create.mockReturnValue(created);
      cardRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(cardRepo.create).toHaveBeenCalledWith({
        title: 'New Card',
        description: null,
        projectId: 'project-1',
      });
      expect(result).toBe(created);
    });

    it('throws ForbiddenException when Member creates in another user project', async () => {
      const dto: CreateCardDto = { title: 'New', projectId: 'project-1' };
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.create(dto, auth)).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin to create in any project', async () => {
      const dto: CreateCardDto = { title: 'New', projectId: 'project-1' };
      const project = makeProject({ userId: 'other-user' });
      const created = makeCard();

      projectService.findOne.mockResolvedValue(project);
      cardRepo.create.mockReturnValue(created);
      cardRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, {
        userId: 'admin-1',
        role: UserRole.Admin,
      });

      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('updates card when user owns project', async () => {
      const card = makeCard();
      const dto: UpdateCardDto = { title: 'Updated' };
      const project = makeProject({ userId: 'user-1' });

      cardRepo.findOne.mockResolvedValue(card);
      projectService.findOne.mockResolvedValue(project);
      cardRepo.save.mockResolvedValue({ ...card, ...dto });

      const result = await service.update('card-1', dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(cardRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws ForbiddenException when Member updates card in another user project', async () => {
      const card = makeCard();
      cardRepo.findOne.mockResolvedValue(card);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(
        service.update('card-1', { title: 'Updated' }, auth),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('removes card when user owns project', async () => {
      const card = makeCard();
      cardRepo.findOne.mockResolvedValue(card);
      projectService.findOne.mockResolvedValue(makeProject({ userId: 'user-1' }));
      cardRepo.remove.mockResolvedValue(undefined);

      await service.remove('card-1', auth);

      expect(cardRepo.remove).toHaveBeenCalledWith(card);
    });

    it('throws ForbiddenException when Member removes card in another user project', async () => {
      const card = makeCard();
      cardRepo.findOne.mockResolvedValue(card);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.remove('card-1', auth)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
