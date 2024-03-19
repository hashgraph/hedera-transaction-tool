import { IsNumber } from 'class-validator';
import { IsBuffer } from '../../validator/is-buffer.validator';

export class UploadSignatureDto {
  @IsNumber()
  userKeyId: number;

  @IsBuffer()
  signature: Buffer;
}
