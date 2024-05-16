import { ITransactionObserverUserId } from '../observers';
import { ITransactionSignerUserKey } from '../signers';

export enum BackEndTransactionType {
  ACCOUNT_CREATE = 'ACCOUNT CREATE',
  ACCOUNT_UPDATE = 'ACCOUNT UPDATE',
  ACCOUNT_DELETE = 'ACCOUNT DELETE',
  FILE_CREATE = 'FILE CREATE',
  FILE_APPEND = 'FILE APPEND',
  FILE_UPDATE = 'FILE UPDATE',
  FILE_DELETE = 'FILE DELETE',
  FREEZE = 'FREEZE',
  SYSTEM_DELETE = 'SYSTEM DELETE',
  SYSTEM_UNDELETE = 'SYSTEM UNDELETE',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  NEW = 'NEW',
  REJECTED = 'REJECTED',
  WAITING_FOR_SIGNATURES = 'WAITING FOR SIGNATURES',
  WAITING_FOR_EXECUTION = 'WAITING FOR EXECUTION',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

export interface ITransaction {
  id: number;
  name: string;
  transactionId: string;
  type: BackEndTransactionType;
  description: string;
  body: string;
  status: TransactionStatus;
  statusCode?: number;
  signature: string;
  validStart: string;
  cutoffAt?: string;
  createdAt: string;
  executedAt?: string;
  updatedAt: string;
  creatorKeyId: number;
}

export interface ITransactionFull extends ITransaction {
  signers: ITransactionSignerUserKey[];
  // approvers: TransactionApproverDto[];
  observers: ITransactionObserverUserId[];
}
