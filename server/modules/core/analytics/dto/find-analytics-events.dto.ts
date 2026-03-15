import { IsOptional, IsUUID, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAnalyticsEventsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  event?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
