import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../audit.entity';

export const AUDIT_KEY = 'audit';

export interface AuditOptions {
  action: AuditAction;
  resourceType: string;
  resourceIdParam?: string;
  /** Skip when no authenticated user */
  requireAuth?: boolean;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
