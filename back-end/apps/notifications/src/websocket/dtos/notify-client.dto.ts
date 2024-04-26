import { IsNotEmpty, IsString } from 'class-validator';

export class NotifyClientDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}