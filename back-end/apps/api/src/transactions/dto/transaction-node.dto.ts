import { Expose } from 'class-transformer';
import { ITransactionNode } from './ITransactionNode';

export class TransactionNodeDto implements ITransactionNode {
  @Expose()
  transactionId?: number;

  @Expose()
  groupId?: number;

  @Expose()
  description: string;

  @Expose()
  validStart: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  sdkTransactionId?: string;

  @Expose()
  transactionType?: string;

  @Expose()
  groupItemCount: number;
}
