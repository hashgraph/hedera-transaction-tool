import { IsNotEmpty, IsString } from 'class-validator';

export class OtpDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
