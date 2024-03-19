import { IsString } from 'class-validator';

export class UploadUserKeyDto {
  @IsString()
  publicKey: string;
}
