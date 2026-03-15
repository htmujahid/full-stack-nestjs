import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Login = 'login',
  Logout = 'logout',
  Custom = 'custom',
}

@Entity('audit_log')
@Index(['resourceType', 'resourceId'])
@Index(['actorId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 64 })
  resourceType: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resourceId: string | null;

  @Column({ type: 'json', nullable: true })
  oldValue: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  newValue: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
