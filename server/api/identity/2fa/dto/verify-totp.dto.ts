import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class VerifyTotpDto {
  @ApiProperty({ description: '6-digit TOTP code' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({
    description: 'Trust this device for 30 days',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
