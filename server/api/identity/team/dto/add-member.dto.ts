import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TeamMemberRole } from '../team-member-role.enum';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsEnum(TeamMemberRole)
  role?: TeamMemberRole;
}
