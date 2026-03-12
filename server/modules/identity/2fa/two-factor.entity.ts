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
import { User } from '../user/user.entity';

@Entity('two_factor')
export class TwoFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index({ unique: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text', select: false })
  secret: string; // AES-256-GCM encrypted base32 TOTP secret

  @Column({ type: 'text', nullable: true, select: false })
  backupCodes: string | null; // JSON array of SHA-256 hashed backup codes

  @Column({ type: 'int', nullable: true, default: null, select: false })
  lastUsedPeriod: number | null; // TOTP period number of last accepted code (replay prevention)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
