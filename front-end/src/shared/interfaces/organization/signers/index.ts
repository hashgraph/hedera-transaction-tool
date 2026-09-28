import type { ITransaction } from '../transactions';
import type { IUserKey } from '../userKeys';

export const SignerTool = {
  V1: 'v1',
  V2: 'v2',
  API: 'api',
} as const;
export type SignerTool = (typeof SignerTool)[keyof typeof SignerTool];

interface IBaseTransactionSigner {
  id: number;
}

export interface ITransactionSigner extends IBaseTransactionSigner {
  transactionId: number;
  userKeyId: number;
  recorderId?: number | null;
  tool?: SignerTool | null;
  version?: string | null;
  createdAt: string | Date;
}

export interface ITransactionSignerUserKey extends IBaseTransactionSigner {
  transactionId: number;
  userKey?: IUserKey;
  recorderId?: number | null;
  tool?: SignerTool | null;
  version?: string | null;
  createdAt: string | Date;
}

export interface ITransactionSignerFull extends IBaseTransactionSigner {
  transaction: ITransaction;
  userKey?: IUserKey;
  recorderId?: number | null;
  tool?: SignerTool | null;
  version?: string | null;
  createdAt: string | Date;
}
