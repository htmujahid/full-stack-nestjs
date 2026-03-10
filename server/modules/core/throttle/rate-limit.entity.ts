import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('rate_limit')
export class RateLimit {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'bigint' })
  lastRequest: number;

  @Column({ type: 'bigint', default: 0 })
  windowStart: number;

  @Column({ type: 'bigint', default: 0 })
  blockExpiresAt: number;
}
