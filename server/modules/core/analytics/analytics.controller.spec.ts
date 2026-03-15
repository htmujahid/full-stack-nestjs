import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEvent } from './analytics-event.entity';
import { FindAnalyticsEventsDto } from './dto/find-analytics-events.dto';
import { mockRepository } from '../../../mocks/db.mock';

const makeEvent = (overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent =>
  ({
    id: 'evt-1',
    event: 'page_view',
    properties: { path: '/home' },
    actorId: 'user-1',
    sessionId: 'sess-1',
    tenantId: null,
    createdAt: new Date(),
    ...overrides,
  }) as AnalyticsEvent;

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let eventRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    eventRepo = {
      ...mockRepository(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    eventRepo.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: getRepositoryToken(AnalyticsEvent), useValue: eventRepo },
      ],
    }).compile();

    controller = module.get(AnalyticsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findMany', () => {
    it('returns items and total with default pagination', async () => {
      const events = [makeEvent(), makeEvent({ id: 'evt-2' })];
      qb.getManyAndCount.mockResolvedValue([events, 2]);

      const dto = new FindAnalyticsEventsDto();
      const result = await controller.findMany(dto);

      expect(eventRepo.createQueryBuilder).toHaveBeenCalledWith('e');
      expect(qb.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(50);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(result).toEqual({ items: events, total: 2 });
    });

    it('adds event filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAnalyticsEventsDto();
      dto.event = 'page_view';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('e.event = :event', {
        event: 'page_view',
      });
    });

    it('adds actorId filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAnalyticsEventsDto();
      dto.actorId = 'actor-123';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('e.actorId = :actorId', {
        actorId: 'actor-123',
      });
    });

    it('adds sessionId filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAnalyticsEventsDto();
      dto.sessionId = 'sess-456';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('e.sessionId = :sessionId', {
        sessionId: 'sess-456',
      });
    });

    it('adds tenantId filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAnalyticsEventsDto();
      dto.tenantId = 'tenant-789';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('e.tenantId = :tenantId', {
        tenantId: 'tenant-789',
      });
    });

    it('adds from and to date filters when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');
      const dto = new FindAnalyticsEventsDto();
      dto.from = from;
      dto.to = to;

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('e.createdAt >= :from', { from });
      expect(qb.andWhere).toHaveBeenCalledWith('e.createdAt <= :to', { to });
    });

    it('applies pagination with limit and offset', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAnalyticsEventsDto();
      dto.limit = 10;
      dto.offset = 20;

      await controller.findMany(dto);

      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.skip).toHaveBeenCalledWith(20);
    });

    it('caps limit at 100', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAnalyticsEventsDto();
      dto.limit = 200;

      await controller.findMany(dto);

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });
});
