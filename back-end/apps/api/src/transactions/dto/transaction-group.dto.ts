import { Expose } from 'class-transformer';

export class TransactionGroupDto {
  @Expose()
  id: number;

  @Expose()
  description: string;

  @Expose()
  atomic: boolean;

  @Expose()
  createdAt: Date;
}