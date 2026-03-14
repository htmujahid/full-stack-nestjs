import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EnableTwoFactorDto {
  @ApiPropertyOptional({
    description: 'Custom TOTP issuer. Defaults to app name.',
  })
  @IsOptional()
  @IsString()
  issuer?: string;
}
