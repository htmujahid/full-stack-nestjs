import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @MaxLength(64)
  type: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  body?: string | null;

  @IsOptional()
  metadata?: Record<string, unknown> | null;
}
