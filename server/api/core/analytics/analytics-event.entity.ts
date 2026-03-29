import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('analytics_event')
@Index(['event', 'createdAt'])
@Index(['actorId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
@Index(['createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  event: string;

  @Column({ type: 'json', nullable: true })
  properties: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
