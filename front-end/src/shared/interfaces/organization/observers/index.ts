export enum ObserverRole {
  STATUS = 'STATUS', // Can only observe the status of the transaction
}

interface IBaseTransactionObserver {
  id: number;
  role: ObserverRole;
  createdAt: string | Date;
}

export interface ITransactionObserverUserId extends IBaseTransactionObserver {
  userId: number;
}
