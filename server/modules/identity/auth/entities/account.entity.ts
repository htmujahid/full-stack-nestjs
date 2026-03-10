import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/user.entity';

@Entity('account')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accountId: string;

  @Column()
  providerId: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text', nullable: true, select: false })
  accessToken: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  refreshToken: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  idToken: string | null;

  @Column({ type: 'datetime', nullable: true })
  accessTokenExpiresAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  refreshTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scope: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
