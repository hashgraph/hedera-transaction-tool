import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class OtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}
