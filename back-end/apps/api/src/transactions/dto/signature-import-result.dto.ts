import { Expose } from 'class-transformer';

export class SignatureImportResultDto {
  @Expose()
  transactionId: number;

  @Expose()
  error?: string;
}