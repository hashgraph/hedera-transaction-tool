import { ITransactionNode } from '../dto/ITransactionNode';

export function compareTransactionNodes(n1: ITransactionNode, n2: ITransactionNode): number {
  let result = compareNodesByGroupId(n1, n2);
  if (result === 0) {
    result = compareNodesByTransactionId(n1, n2);
  }
  if (result === 0) {
    result = compareNodesByCreatedAtd(n1, n2);
  }
  return result;
}

function compareNodesByGroupId(n1: ITransactionNode, n2: ITransactionNode): number {
  let result: number;
  if (n1.groupId && n2.groupId) {
    if (n1.groupId !== n2.groupId) {
      result = n1.groupId < n2.groupId ? +1 : -1;
    } else {
      result = 0;
    }
  } else if (n1.groupId) {
    result = +1;
  } else if (n2.groupId) {
    result = -1
  } else {
    result = 0;
  }
  return result;
}

function compareNodesByTransactionId(n1: ITransactionNode, n2: ITransactionNode): number {
  let result: number;
  if (n1.transactionId && n2.transactionId) {
    if (n1.transactionId !== n2.transactionId) {
      result = n1.transactionId < n2.transactionId ? +1 : -1;
    } else {
      result = 0;
    }
  } else if (n1.transactionId) {
    result = +1;
  } else if (n2.transactionId) {
    result = -1
  } else {
    result = 0;
  }
  return result;
}

function compareNodesByCreatedAtd(n1: ITransactionNode, n2: ITransactionNode): number {
  let result: number;
  if (n1.createdAt != n2.createdAt) {
    result = n1.createdAt < n2.createdAt ? +1 : -1;
  } else {
    result = 0;
  }
  return result;
}
