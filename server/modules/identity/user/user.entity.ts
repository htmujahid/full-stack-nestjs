import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Account } from '../account/account.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true, type: 'varchar' })
  username: string | null;

  @Column({ unique: true, nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ default: false })
  phoneVerified: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true })
  image: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Account', 'user')
  accounts?: Account[];
}
