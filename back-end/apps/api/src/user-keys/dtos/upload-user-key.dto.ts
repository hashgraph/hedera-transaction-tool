import { IsNotEmpty, IsNumber, IsString, ValidateIf } from 'class-validator';

export class UploadUserKeyDto {
  @ValidateIf(val => val.index)
  @IsString()
  @IsNotEmpty()
  mnemonicHash?: string;

  @ValidateIf(val => val.mnemonicHash)
  @IsNumber()
  @IsNotEmpty()
  index?: number;

  @IsString()
  @IsNotEmpty()
  publicKey: string;
}
