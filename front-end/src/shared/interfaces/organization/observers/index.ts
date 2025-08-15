export enum ObserverRole {
  APPROVER = 'APPROVER', // Can only observe the approver interactions
  STATUS = 'STATUS', // Can only observe the status of the transaction
  FULL = 'FULL', // Can observe all information of the transaction
}

interface IBaseTransactionObserver {
  id: number;
  role: ObserverRole;
  createdAt: string | Date;
}

export interface ITransactionObserverUserId extends IBaseTransactionObserver {
  userId: number;
}

export interface ITransactionObserverTransactionId extends IBaseTransactionObserver {
  transactionId: number;
}

export interface ITransactionObserverFull
  extends ITransactionObserverUserId,
    ITransactionObserverTransactionId {}
