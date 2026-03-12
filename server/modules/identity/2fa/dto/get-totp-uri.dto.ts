import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetTotpUriDto {
  @ApiProperty()
  @IsString()
  password: string;
}
