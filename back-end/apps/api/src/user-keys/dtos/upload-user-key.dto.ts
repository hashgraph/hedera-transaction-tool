import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UploadUserKeyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mnemonicHash?: string;

  @IsOptional()
  @IsNumber()
  index?: number;

  @IsString()
  @IsNotEmpty()
  publicKey: string;
}
