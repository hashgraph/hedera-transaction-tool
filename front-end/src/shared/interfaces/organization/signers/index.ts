import type { ITransaction } from '../transactions';
import type { IUserKey } from '../userKeys';

interface IBaseTransactionSigner {
  id: number;
}

export interface ITransactionSigner extends IBaseTransactionSigner {
  transactionId: number;
  userKeyId: number;
  recorderId?: number | null;
  tool?: string | null;
  version?: string | null;
  createdAt: string | Date;
}

export interface ITransactionSignerUserKey extends IBaseTransactionSigner {
  transactionId: number;
  userKey?: IUserKey;
  recorderId?: number | null;
  tool?: string | null;
  version?: string | null;
  createdAt: string | Date;
}

export interface ITransactionSignerFull extends IBaseTransactionSigner {
  transaction: ITransaction;
  userKey?: IUserKey;
  recorderId?: number | null;
  tool?: string | null;
  version?: string | null;
  createdAt: string | Date;
}
