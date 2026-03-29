import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  username?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phone?: string | null;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsUrl()
  @IsOptional()
  @MaxLength(512)
  image?: string | null;
}
