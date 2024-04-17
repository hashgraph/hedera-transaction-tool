import { Expose, Type } from 'class-transformer';

import { TransactionDto } from './transaction.dto';
import { UserKeyCoreDto } from '../../user-keys/dtos';

export class TransactionSignerDto {
  @Expose()
  id: number;

  @Expose()
  @Type(() => TransactionDto)
  transaction: TransactionDto;

  @Expose()
  @Type(() => UserKeyCoreDto)
  userKey: UserKeyCoreDto;

  @Expose()
  createdAt: Date;
}
