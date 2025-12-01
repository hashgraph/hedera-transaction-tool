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
  createdAt: string;

  @Expose()
  validStart: string;

  @Expose()
  updatedAt: string;

  @Expose()
  executedAt?: string;

  @Expose()
  status?: string;

  @Expose()
  statusCode?: number;

  @Expose()
  sdkTransactionId?: string;

  @Expose()
  transactionType?: string;

  @Expose()
  groupItemCount?: number;
}
