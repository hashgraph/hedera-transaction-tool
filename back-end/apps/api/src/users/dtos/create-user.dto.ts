import { IsBoolean, IsEmail, IsOptional, IsStrongPassword } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 0,
      minNumbers: 0,
      minSymbols: 0,
      minUppercase: 0,
    },
    {
      message: 'Password is too weak, must contain at least 8 characters.',
    },
  )
  password: string;

  @IsOptional()
  @IsBoolean()
  admin?: boolean;
}
