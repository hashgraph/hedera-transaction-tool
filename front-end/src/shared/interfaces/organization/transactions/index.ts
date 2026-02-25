import { SignatureMap } from '@hashgraph/sdk';

import type { ITransactionApprover } from '../approvers';
import type { ITransactionObserverUserId } from '../observers';
import type { ITransactionSignerUserKey } from '../signers';

export enum BackEndTransactionType {
  ACCOUNT_CREATE = 'ACCOUNT CREATE',
  ACCOUNT_UPDATE = 'ACCOUNT UPDATE',
  ACCOUNT_DELETE = 'ACCOUNT DELETE',
  ACCOUNT_ALLOWANCE_APPROVE = 'ACCOUNT ALLOWANCE APPROVE',
  FILE_CREATE = 'FILE CREATE',
  FILE_APPEND = 'FILE APPEND',
  FILE_UPDATE = 'FILE UPDATE',
  FILE_DELETE = 'FILE DELETE',
  FREEZE = 'FREEZE',
  SYSTEM_DELETE = 'SYSTEM DELETE',
  SYSTEM_UNDELETE = 'SYSTEM UNDELETE',
  TRANSFER = 'TRANSFER',
  NODE_CREATE = 'NODE CREATE',
  NODE_UPDATE = 'NODE UPDATE',
  NODE_DELETE = 'NODE DELETE',
}

export const TransactionTypeName = {
  [BackEndTransactionType.ACCOUNT_CREATE]: 'Account Create Transaction',
  [BackEndTransactionType.ACCOUNT_UPDATE]: 'Account Update Transaction',
  [BackEndTransactionType.ACCOUNT_DELETE]: 'Account Delete Transaction',
  [BackEndTransactionType.ACCOUNT_ALLOWANCE_APPROVE]: 'Account Allowance Approve Transaction',
  [BackEndTransactionType.FILE_CREATE]: 'File Create Transaction',
  [BackEndTransactionType.FILE_APPEND]: 'File Append Transaction',
  [BackEndTransactionType.FILE_UPDATE]: 'File Update Transaction',
  [BackEndTransactionType.FILE_DELETE]: 'File Delete Transaction',
  [BackEndTransactionType.FREEZE]: 'Freeze Transaction',
  [BackEndTransactionType.SYSTEM_DELETE]: 'System Delete Transaction',
  [BackEndTransactionType.SYSTEM_UNDELETE]: 'System Undelete Transaction',
  [BackEndTransactionType.TRANSFER]: 'Transfer Transaction',
  [BackEndTransactionType.NODE_CREATE]: 'Node Create Transaction',
  [BackEndTransactionType.NODE_UPDATE]: 'Node Update Transaction',
  [BackEndTransactionType.NODE_DELETE]: 'Node Delete Transaction',
};

export enum TransactionStatus {
  NEW = 'NEW', // unused
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  WAITING_FOR_SIGNATURES = 'WAITING FOR SIGNATURES',
  WAITING_FOR_EXECUTION = 'WAITING FOR EXECUTION',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export interface ITransaction {
  id: number;
  name: string;
  transactionId: string;
  type: BackEndTransactionType;
  description: string;
  transactionBytes: string;
  status: TransactionStatus;
  statusCode?: number;
  signature: string;
  validStart: string;
  isManual: boolean;
  cutoffAt?: string;
  createdAt: string;
  executedAt?: string;
  updatedAt: string;
  mirrorNetwork: string;
  creatorKeyId: number;
  creatorId: number;
  creatorEmail: string;
  groupItem?: IGroupItem;
}

export interface ITransactionFull extends ITransaction {
  signers: ITransactionSignerUserKey[];
  approvers: ITransactionApprover[];
  observers: ITransactionObserverUserId[];
}

export interface IGroupItem {
  seq: number;
  transactionId: number;
  groupId: number;
  transaction: ITransaction;
  group?: IGroup;
}

export interface IGroup {
  id: number;
  description: string;
  atomic: boolean;
  sequential: boolean;
  createdAt: Date;
  groupItems: IGroupItem[];
}

export type IDefaultNetworks = 'mainnet' | 'testnet' | 'previewnet' | 'local-node';

/** Request/Response DTOs */
export interface ISignatureImport {
  id: number; // Database ID of the transaction to which the signatures belong. In a bulk transaction (File Append with multiple transactions inside), this ID refers to the parent transaction.
  signatureMap: SignatureMap;
}

export interface SignatureImportResultDto {
  id: number; // The database ID of the transaction
  error?: string;
}
