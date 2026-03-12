import { TransactionSignerDto } from './transaction-signer.dto';
import { Expose, Type } from 'class-transformer';

export class UploadSignatureMapResponseDto {
  @Expose()
  @Type(() => TransactionSignerDto)
  signers: TransactionSignerDto[];

  @Expose()
  notificationReceiverIds: number[];
}