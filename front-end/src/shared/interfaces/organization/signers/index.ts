import type { ITransaction } from '../transactions';
import type { IUserKey } from '../userKeys';

interface IBaseTransactionSigner {
  id: number;
}

export interface ITransactionSigner extends IBaseTransactionSigner {
  transactionId: number;
  userKeyId: number;
  createdAt: string | Date;
}

export interface ITransactionSignerUserKey extends IBaseTransactionSigner {
  transactionId: number;
  userKey?: IUserKey;
  createdAt: string | Date;
}

export interface ITransactionSignerFull extends IBaseTransactionSigner {
  transaction: ITransaction;
  userKey?: IUserKey;
  createdAt: string | Date;
}
