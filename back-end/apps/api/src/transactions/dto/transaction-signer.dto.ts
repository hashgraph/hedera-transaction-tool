import { Expose, Type } from 'class-transformer';
import { UserKeyCoreDto } from '../../user-keys/dtos';
import { TransactionDto } from './transaction.dto';

export class TransactionSignerDto {
  @Expose()
  id: number;

  @Expose()
  transactionId: number;

  @Expose()
  userKeyId: number;

  @Expose()
  createdAt: Date;
}

export class TransactionSignerUserKeyDto {
  @Expose()
  id: number;

  @Expose()
  transactionId: number;

  @Expose()
  @Type(() => UserKeyCoreDto)
  userKey: UserKeyCoreDto;

  @Expose()
  createdAt: Date;
}

export class TransactionSignerFullDto {
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
