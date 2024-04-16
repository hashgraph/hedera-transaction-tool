import { IsEmail } from 'class-validator';

export class OtpLocalDto {
  @IsEmail()
  email: string;
}
