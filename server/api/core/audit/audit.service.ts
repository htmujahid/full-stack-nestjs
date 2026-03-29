import { Injectable, Optional, Inject } from '@nestjs/common';
import { AuditAction } from './audit.entity';
import type { AuditEntry, IAuditSink } from './audit-sink.interface';

export const AUDIT_SINKS = 'AUDIT_SINKS';

@Injectable()
export class AuditService {
  constructor(
    @Optional()
    @Inject(AUDIT_SINKS)
    private readonly sinks: IAuditSink[] = [],
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    if (this.sinks.length === 0) return;
    await Promise.all(this.sinks.map((s) => s.write(entry)));
  }

  async logCreate(
    resourceType: string,
    resourceId: string,
    newValue: Record<string, unknown>,
    ctx: Partial<AuditEntry> = {},
  ): Promise<void> {
    await this.log({
      ...ctx,
      action: AuditAction.Create,
      resourceType,
      resourceId,
      newValue,
    });
  }

  async logUpdate(
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    ctx: Partial<AuditEntry> = {},
  ): Promise<void> {
    await this.log({
      ...ctx,
      action: AuditAction.Update,
      resourceType,
      resourceId,
      oldValue,
      newValue,
    });
  }

  async logDelete(
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    ctx: Partial<AuditEntry> = {},
  ): Promise<void> {
    await this.log({
      ...ctx,
      action: AuditAction.Delete,
      resourceType,
      resourceId,
      oldValue,
    });
  }

  async logCustom(
    action: string,
    resourceType: string,
    ctx: Partial<AuditEntry> & { resourceId?: string } = {},
  ): Promise<void> {
    const { resourceId, ...rest } = ctx;
    await this.log({
      ...rest,
      action: AuditAction.Custom,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: { ...rest.metadata, customAction: action },
    });
  }
}
