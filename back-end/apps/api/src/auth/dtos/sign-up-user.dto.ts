import { IsEmail } from 'class-validator';

export class SignUpUserDto {
  @IsEmail()
  email: string;
}
