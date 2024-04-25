import { Expose, Transform } from 'class-transformer';

export class TranasctionExecutedDto {
  @Expose()
  response?: string;

  @Expose()
  receipt?: string;

  @Expose()
  @Transform(({ obj }) => obj.receiptBytes.toString('hex'))
  receiptBytes?: Buffer;

  @Expose()
  error?: string;
}
