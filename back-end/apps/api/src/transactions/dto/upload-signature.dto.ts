import { IsDefined, IsNotEmptyObject, IsNumber, IsObject } from 'class-validator';

export class UploadSignatureDto {
  @IsNumber()
  signaturePublicKeyId: number;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  signatures: { [key: string]: Buffer };
}
