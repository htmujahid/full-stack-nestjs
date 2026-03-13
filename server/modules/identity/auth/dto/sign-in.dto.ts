import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({
    description: 'Email address, username, or phone number',
    example: 'user@example.com',
  })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'Keep session alive for 30 days. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
