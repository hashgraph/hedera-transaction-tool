import { ITransaction } from '../transactions';
import { IUserKey } from '../userKeys';

interface IBaseTransactionSigner {
  id: number;
}

export interface ITransactionSignerDto extends IBaseTransactionSigner {
  transactionId: number;
  userKeyId: number;
  createdAt: string | Date;
}

export interface ITransactionSignerUserKeyDto extends IBaseTransactionSigner {
  transactionId: number;
  userKey: IUserKey;
  createdAt: string | Date;
}

export interface ITransactionSignerFullDto extends IBaseTransactionSigner {
  transaction: ITransaction;
  userKey: IUserKey;
  createdAt: string | Date;
}
