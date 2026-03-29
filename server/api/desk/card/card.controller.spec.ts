import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { Card } from './card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { FindCardsDto } from './dto/find-cards.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

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

const makeRequest = (
  userId: string,
  role: UserRole = UserRole.Member,
): Request => ({ user: { userId, role } }) as unknown as Request;

const mockCardService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('CardController', () => {
  let controller: CardController;
  let service: ReturnType<typeof mockCardService>;

  beforeEach(async () => {
    service = mockCardService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardController],
      providers: [{ provide: CardService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(CardController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll(dto, auth) and returns CardsPage', async () => {
      const dto: FindCardsDto = {};
      const page = { data: [makeCard()], total: 1, page: 1, limit: 20 };
      const req = makeRequest('user-1');

      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto, req);

      expect(service.findAll).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(page);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id)', async () => {
      const card = makeCard();
      service.findOne.mockResolvedValue(card);

      const result = await controller.findOne('card-1');

      expect(service.findOne).toHaveBeenCalledWith('card-1');
      expect(result).toBe(card);
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Card not found'),
      );

      await expect(controller.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create(dto, auth)', async () => {
      const dto: CreateCardDto = { title: 'New', projectId: 'proj-1' };
      const card = makeCard({ title: 'New' });
      const req = makeRequest('user-1');

      service.create.mockResolvedValue(card);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(card);
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto, auth)', async () => {
      const dto: UpdateCardDto = { title: 'Updated' };
      const updated = makeCard({ title: 'Updated' });
      const req = makeRequest('user-1');

      service.update.mockResolvedValue(updated);

      const result = await controller.update('card-1', dto, req);

      expect(service.update).toHaveBeenCalledWith('card-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(updated);
    });

    it('propagates ForbiddenException', async () => {
      const req = makeRequest('user-1');
      service.update.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.update('card-1', { title: 'x' }, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id, auth)', async () => {
      const req = makeRequest('user-1');
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('card-1', req);

      expect(service.remove).toHaveBeenCalledWith('card-1', {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBeUndefined();
    });
  });
});
