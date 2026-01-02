import { IsDefined, IsNotEmpty, IsNumber, IsString, ValidateIf } from 'class-validator';
import { IsHederaPublicKey } from '@app/common/validators/is-hedera-public-key.validator';
import { NormalizePublicKey } from '@app/common/transformers/normalize-public-key.transform';

export class UploadUserKeyDto {
  @ValidateIf(val => val.index !== undefined)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  mnemonicHash?: string;

  @ValidateIf(val => val.mnemonicHash !== undefined)
  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  index?: number;

  @IsNotEmpty()
  @IsHederaPublicKey()
  @NormalizePublicKey()
  publicKey: string;
}
