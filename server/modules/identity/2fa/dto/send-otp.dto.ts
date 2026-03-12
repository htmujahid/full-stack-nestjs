import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SendOtpDto {
  @ApiPropertyOptional({
    description: 'Trust this device for 30 days after OTP verification',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
