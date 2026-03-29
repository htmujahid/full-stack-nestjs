import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './audit.entity';
import type { AuditEntry, IAuditSink } from './audit-sink.interface';

@Injectable()
export class DbAuditSink implements IAuditSink {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async write(entry: AuditEntry): Promise<void> {
    const log = this.repo.create({
      actorId: entry.actorId ?? null,
      action: entry.action as AuditAction,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      tenantId: entry.tenantId ?? null,
    });
    await this.repo.save(log);
  }
}
