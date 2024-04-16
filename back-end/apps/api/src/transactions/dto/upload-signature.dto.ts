import { IsDefined, IsNotEmpty, IsNotEmptyObject, IsObject } from 'class-validator';

export class UploadSignatureDto {
  @IsNotEmpty()
  publicKey: string;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  signatures: { [key: string]: Buffer };
}
