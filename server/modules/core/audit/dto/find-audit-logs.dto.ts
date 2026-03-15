import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction } from '../audit.entity';

export class FindAuditLogsDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  resourceType?: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

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
