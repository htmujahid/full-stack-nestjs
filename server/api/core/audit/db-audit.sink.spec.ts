import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DbAuditSink } from './db-audit.sink';
import { AuditLog, AuditAction } from './audit.entity';
import type { AuditEntry } from './audit-sink.interface';
import { mockRepository } from '../../../mocks/db.mock';

describe('DbAuditSink', () => {
  let sink: DbAuditSink;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    repo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbAuditSink,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();

    sink = module.get(DbAuditSink);
  });

  afterEach(() => jest.clearAllMocks());

  describe('write', () => {
    it('creates and saves entity from entry', async () => {
      const entry: AuditEntry = {
        actorId: 'user-1',
        action: AuditAction.Create,
        resourceType: 'user',
        resourceId: 'u1',
        newValue: { name: 'Alice' },
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        tenantId: 'tenant-1',
      };
      const created = { id: 'log-1', ...entry } as AuditLog;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await sink.write(entry);

      expect(repo.create).toHaveBeenCalledWith({
        actorId: 'user-1',
        action: AuditAction.Create,
        resourceType: 'user',
        resourceId: 'u1',
        oldValue: null,
        newValue: { name: 'Alice' },
        metadata: null,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        tenantId: 'tenant-1',
      });
      expect(repo.save).toHaveBeenCalledWith(created);
    });

    it('maps null for optional fields when missing', async () => {
      const entry: AuditEntry = {
        action: AuditAction.Delete,
        resourceType: 'user',
        resourceId: 'u1',
        oldValue: null,
      };
      const created = {} as AuditLog;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await sink.write(entry);

      expect(repo.create).toHaveBeenCalledWith({
        actorId: null,
        action: AuditAction.Delete,
        resourceType: 'user',
        resourceId: 'u1',
        oldValue: null,
        newValue: null,
        metadata: null,
        ip: null,
        userAgent: null,
        tenantId: null,
      });
    });
  });
});
