import { IsNotEmpty, IsNumber } from 'class-validator';
import { TransformBuffer } from '@app/common';

export class UploadSignatureDto {
  @IsNumber()
  userKeyId: number;

  @IsNotEmpty()
  @TransformBuffer()
  signature: Buffer;
}
