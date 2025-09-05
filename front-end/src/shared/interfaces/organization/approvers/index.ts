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
  approvers?: ITransactionApprover[];
}

export interface TransactionApproverDto {
  listId?: number;
  threshold?: number;
  userId?: number;
  approvers?: TransactionApproverDto[];
}
