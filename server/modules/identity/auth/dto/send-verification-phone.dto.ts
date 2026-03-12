import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendVerificationPhoneDto {
  @ApiProperty({ description: 'Phone number in E.164 format' })
  @IsString()
  phone: string;
}
