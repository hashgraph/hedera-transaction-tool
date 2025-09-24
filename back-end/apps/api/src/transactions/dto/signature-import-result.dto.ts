import { Expose } from 'class-transformer';

export class SignatureImportResultDto {
  // The database ID of the transaction
  @Expose()
  id: number;

  @Expose()
  error?: string;
}