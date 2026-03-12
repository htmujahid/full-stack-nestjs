import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EnableTwoFactorDto {
  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'Custom TOTP issuer. Defaults to app name.',
  })
  @IsOptional()
  @IsString()
  issuer?: string;
}
