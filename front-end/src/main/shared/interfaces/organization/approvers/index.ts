interface IBaseTransactionApprover {
  id: number;
  createdAt: string | Date;
}

export interface ITransactionApprover extends IBaseTransactionApprover {
  listId?: number;
  threshold?: number;
  userId?: number;
  userKeyId?: number;
  signature?: string;
  approved?: boolean;
}
