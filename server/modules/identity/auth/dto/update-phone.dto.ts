import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdatePhoneDto {
  @ApiProperty({
    description: 'New phone number in E.164 format, e.g. +12345678900',
  })
  @IsString()
  newPhone: string;
}
