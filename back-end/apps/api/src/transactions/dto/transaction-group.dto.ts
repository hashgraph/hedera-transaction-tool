import { Expose, Type } from 'class-transformer';
import { TransactionGroupItemDto } from './transaction-group-item.dto';

export class TransactionGroupDto {
  @Expose()
  id: number;

  @Expose()
  description: string;

  @Expose()
  atomic: boolean;

  @Expose()
  sequential: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  groupValidTime: Date;

  @Expose()
  @Type(() => TransactionGroupItemDto)
  groupItems: TransactionGroupItemDto[];
}
