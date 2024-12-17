import { IsStrongPassword } from 'class-validator';

export class NewPasswordDto {
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
}
