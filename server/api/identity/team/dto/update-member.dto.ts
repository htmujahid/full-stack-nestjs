import { IsEnum } from 'class-validator';
import { TeamMemberRole } from '../team-member-role.enum';

export class UpdateMemberDto {
  @IsEnum(TeamMemberRole)
  role: TeamMemberRole;
}
