import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string | null;
}
