import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AUDIT_SINKS } from './audit.service';
import { AuditAction } from './audit.entity';
import type { AuditEntry, IAuditSink } from './audit-sink.interface';

const makeSink = (): IAuditSink => ({ write: jest.fn().mockResolvedValue(undefined) });

describe('AuditService', () => {
  let service: AuditService;
  let sinks: IAuditSink[];

  beforeEach(async () => {
    sinks = [makeSink(), makeSink()];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AUDIT_SINKS, useValue: sinks },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('log', () => {
    it('writes to all sinks when sinks are present', async () => {
      const entry: AuditEntry = {
        action: AuditAction.Create,
        resourceType: 'user',
        resourceId: 'u1',
        newValue: { name: 'foo' },
      };

      await service.log(entry);

      expect(sinks[0].write).toHaveBeenCalledWith(entry);
      expect(sinks[1].write).toHaveBeenCalledWith(entry);
    });

    it('returns early when no sinks (does not throw)', async () => {
      const moduleNoSinks = await Test.createTestingModule({
        providers: [
          AuditService,
          { provide: AUDIT_SINKS, useValue: [] },
        ],
      }).compile();
      const svc = moduleNoSinks.get(AuditService);

      await expect(svc.log({ action: 'create', resourceType: 'x', resourceId: '1' })).resolves.toBeUndefined();
    });
  });

  describe('logCreate', () => {
    it('logs with Create action and newValue', async () => {
      const newValue = { name: 'Alice' };
      await service.logCreate('user', 'u1', newValue);

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.Create,
          resourceType: 'user',
          resourceId: 'u1',
          newValue,
        }),
      );
    });

    it('merges ctx into entry', async () => {
      await service.logCreate('user', 'u1', { x: 1 }, {
        actorId: 'a1',
        tenantId: 't1',
      });

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'a1',
          tenantId: 't1',
        }),
      );
    });
  });

  describe('logUpdate', () => {
    it('logs with Update action, oldValue and newValue', async () => {
      const oldValue = { name: 'Alice' };
      const newValue = { name: 'Bob' };
      await service.logUpdate('user', 'u1', oldValue, newValue);

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.Update,
          resourceType: 'user',
          resourceId: 'u1',
          oldValue,
          newValue,
        }),
      );
    });

    it('merges ctx into entry', async () => {
      await service.logUpdate('user', 'u1', {}, {}, { actorId: 'a1' });

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'a1' }),
      );
    });
  });

  describe('logDelete', () => {
    it('logs with Delete action and oldValue', async () => {
      const oldValue = { name: 'Alice' };
      await service.logDelete('user', 'u1', oldValue);

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.Delete,
          resourceType: 'user',
          resourceId: 'u1',
          oldValue,
        }),
      );
    });

    it('merges ctx into entry', async () => {
      await service.logDelete('user', 'u1', {}, { tenantId: 't1' });

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1' }),
      );
    });
  });

  describe('logCustom', () => {
    it('logs with Custom action and customAction in metadata', async () => {
      await service.logCustom('approve', 'order', { resourceId: 'o1' });

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.Custom,
          resourceType: 'order',
          resourceId: 'o1',
          metadata: { customAction: 'approve' },
        }),
      );
    });

    it('uses resourceId null when not provided', async () => {
      await service.logCustom('login', 'session');

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: null,
          metadata: { customAction: 'login' },
        }),
      );
    });

    it('merges ctx into entry', async () => {
      await service.logCustom('approve', 'order', {
        actorId: 'a1',
        metadata: { extra: 'foo' },
      });

      expect(sinks[0].write).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'a1',
          metadata: { extra: 'foo', customAction: 'approve' },
        }),
      );
    });
  });
});
