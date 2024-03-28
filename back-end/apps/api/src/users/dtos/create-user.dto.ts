import { IsBoolean, IsEmail, IsEnum, IsOptional, IsStrongPassword } from 'class-validator';
import { UserStatus } from '@entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 0,
    minNumbers: 0,
    minSymbols: 0,
    minUppercase: 0,
  })
  password: string;

  @IsOptional()
  @IsBoolean()
  admin?: boolean;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
