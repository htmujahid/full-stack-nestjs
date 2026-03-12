import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class VerifyBackupCodeDto {
  @ApiProperty({ description: 'Backup code in XXXXX-XXXXX format' })
  @Matches(/^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/, {
    message: 'code must be in XXXXX-XXXXX format',
  })
  code: string;

  @ApiPropertyOptional({
    description: 'Trust this device for 30 days',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
