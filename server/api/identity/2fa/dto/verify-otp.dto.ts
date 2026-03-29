import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: '6-digit OTP code sent to email' })
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
