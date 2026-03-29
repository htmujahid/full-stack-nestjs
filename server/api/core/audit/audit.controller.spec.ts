import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction } from './audit.entity';
import { FindAuditLogsDto } from './dto/find-audit-logs.dto';
import { mockRepository } from '../../../mocks/db.mock';

const makeAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog =>
  ({
    id: 'log-1',
    actorId: 'user-1',
    action: AuditAction.Create,
    resourceType: 'user',
    resourceId: 'u1',
    oldValue: null,
    newValue: { name: 'Alice' },
    metadata: null,
    ip: null,
    userAgent: null,
    tenantId: null,
    createdAt: new Date(),
    ...overrides,
  }) as AuditLog;

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

describe('AuditController', () => {
  let controller: AuditController;
  let auditRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    auditRepo = {
      ...mockRepository(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    auditRepo.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();

    controller = module.get(AuditController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findMany', () => {
    it('returns items and total with default pagination', async () => {
      const logs = [makeAuditLog(), makeAuditLog({ id: 'log-2' })];
      qb.getManyAndCount.mockResolvedValue([logs, 2]);

      const dto = new FindAuditLogsDto();
      const result = await controller.findMany(dto);

      expect(auditRepo.createQueryBuilder).toHaveBeenCalledWith('a');
      expect(qb.orderBy).toHaveBeenCalledWith('a.createdAt', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(50);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(result).toEqual({ items: logs, total: 2 });
    });

    it('adds actorId filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.actorId = 'actor-123';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('a.actorId = :actorId', {
        actorId: 'actor-123',
      });
    });

    it('adds action filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.action = AuditAction.Delete;

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('a.action = :action', {
        action: AuditAction.Delete,
      });
    });

    it('adds resourceType filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.resourceType = 'user';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('a.resourceType = :resourceType', {
        resourceType: 'user',
      });
    });

    it('adds resourceId filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.resourceId = 'resource-456';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('a.resourceId = :resourceId', {
        resourceId: 'resource-456',
      });
    });

    it('adds tenantId filter when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.tenantId = 'tenant-789';

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('a.tenantId = :tenantId', {
        tenantId: 'tenant-789',
      });
    });

    it('adds from and to date filters when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');
      const dto = new FindAuditLogsDto();
      dto.from = from;
      dto.to = to;

      await controller.findMany(dto);

      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt >= :from', { from });
      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt <= :to', { to });
    });

    it('applies pagination with limit and offset', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.limit = 10;
      dto.offset = 20;

      await controller.findMany(dto);

      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.skip).toHaveBeenCalledWith(20);
    });

    it('caps limit at 100', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      const dto = new FindAuditLogsDto();
      dto.limit = 200;

      await controller.findMany(dto);

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });
});
