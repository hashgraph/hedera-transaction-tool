import { Expose } from 'class-transformer';
import { ITransactionNode } from '../../../../../../middle-end/src/ITransactionNode';

export class TransactionNodeDto implements ITransactionNode {
  @Expose()
  transactionId?: string;

  @Expose()
  groupId?: number;

  @Expose()
  description: string;

  @Expose()
  validStart: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  itemCount: number;
}
