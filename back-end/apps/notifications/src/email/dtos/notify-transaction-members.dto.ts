import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class NotifyTransactionMembersDto {
  @IsEmail()
  emails: string[];

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}
