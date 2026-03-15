import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Team } from './team.entity';
import type { User } from '../user/user.entity';
import { TeamMemberRole } from './team-member-role.enum';

@Entity('team_member')
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  teamId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'enum', enum: TeamMemberRole, default: TeamMemberRole.Member })
  role: TeamMemberRole;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne('Team', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team?: Team;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;
}
