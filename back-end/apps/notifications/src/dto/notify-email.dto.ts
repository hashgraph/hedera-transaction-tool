import { IsEmail, IsNumber } from 'class-validator';

export class NotifyEmailDto {
  @IsEmail()
  email: string;

  @IsNumber()
  token: number;
}