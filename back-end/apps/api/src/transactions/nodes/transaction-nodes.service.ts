import { Injectable } from '@nestjs/common';
import { Transaction, TransactionStatus, User } from '@entities';
import { Filtering, Pagination } from '@app/common';
import { TransactionNodeDto } from '../dto';
import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { TransactionsService } from '../transactions.service';
import { TransactionGroupsService } from '../groups';

const PAGINATION_ALL: Pagination = {
  page: 0,
  limit: Number.MAX_SAFE_INTEGER,
  size: Number.MAX_SAFE_INTEGER,
  offset: 0,
};

@Injectable()
export class TransactionNodesService {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly transactionGroupsService: TransactionGroupsService,
  ) {}

  async getTransactionNodes(
    user: User,
    collection: TransactionNodeCollection,
  ): Promise<TransactionNodeDto[]> {
    let transactions: Transaction[];
    switch (collection) {
      case TransactionNodeCollection.READY_FOR_REVIEW: {
        const p = await this.transactionsService.getTransactionsToApprove(user, PAGINATION_ALL);
        transactions = p.items;
        break;
      }
      case TransactionNodeCollection.READY_TO_SIGN: {
        const r = await this.transactionsService.getTransactionsToSign(user, PAGINATION_ALL);
        transactions = r.items.map(v => v.transaction);
        break;
      }
      case TransactionNodeCollection.READY_FOR_EXECUTION: {
        const filter: Filtering = {
          property: 'status',
          rule: 'eq',
          value: TransactionStatus.WAITING_FOR_EXECUTION,
        };
        const p = await this.transactionsService.getTransactions(user, PAGINATION_ALL, undefined, [
          filter,
        ]);
        transactions = p.items;
        break;
      }
      case TransactionNodeCollection.IN_PROGRESS: {
        const filter: Filtering = {
          property: 'status',
          rule: 'eq',
          value: TransactionStatus.WAITING_FOR_SIGNATURES,
        };
        const p = await this.transactionsService.getTransactions(user, PAGINATION_ALL, undefined, [
          filter,
        ]);
        transactions = p.items;
        break;
      }
      case TransactionNodeCollection.HISTORY: {
        const p = await this.transactionsService.getHistoryTransactions(
          // user,
          PAGINATION_ALL,
        );
        transactions = p.items;
        break;
      }
    }

    // Aggregates transactions by group
    const transactionsByGroup = new Map<number, Transaction[]>();
    for (const t of transactions) {
      const groupId = t.groupItem?.groupId ?? -1;
      const items = transactionsByGroup.get(groupId);
      if (items) {
        items.push(t);
      } else {
        transactionsByGroup.set(groupId, [t]);
      }
    }

    // Makes transaction nodes
    const result: TransactionNodeDto[] = [];
    for (const [groupId, transactions] of transactionsByGroup) {
      if (groupId === -1) {
        // transactions contains the single transactions
        for (const t of transactions) {
          const node = new TransactionNodeDto();
          node.transactionId = t.id;
          node.groupId = undefined;
          node.description = t.description;
          node.createdAt = t.createdAt.toISOString();
          node.validStart = t.validStart.toISOString();
          node.updatedAt = t.updatedAt.toISOString();
          node.executedAt = t.executedAt?.toISOString();
          node.status = t.status;
          node.statusCode = t.statusCode;
          node.sdkTransactionId = t.transactionId;
          node.transactionType = t.type;
          node.groupItemCount = undefined;
          node.groupCollectedCount = undefined;
          result.push(node);
        }
      } else {
        const group = await this.transactionGroupsService.getTransactionGroup(user, groupId);
        const node = new TransactionNodeDto();
        node.transactionId = undefined;
        node.groupId = groupId;
        node.description = group.description;
        node.createdAt = group.createdAt.toISOString();
        node.validStart = minValidStart(transactions).toISOString();
        node.updatedAt = maxUpdatedAt(transactions).toISOString();
        node.executedAt = maxExecutedAt(transactions)?.toISOString();
        node.status = calculateStatusForGroup(transactions);
        node.statusCode = calculateStatusCodeForGroup(transactions);
        node.sdkTransactionId = undefined;
        node.transactionType = undefined;
        node.groupItemCount = group.groupItems.length;
        node.groupCollectedCount = transactions.length;
        result.push(node);
      }
    }

    return Promise.resolve(result);
  }
}

function minValidStart(transactions: Transaction[]): Date {
  let result: Date;
  if (transactions.length === 0) {
    throw new Error('Group with no transactions');
  } else {
    result = transactions[0].validStart;
    for (const t of transactions) {
      if (t.validStart < result) {
        result = t.validStart;
      }
    }
  }
  return result;
}

function maxUpdatedAt(transactions: Transaction[]): Date {
  let result: Date;
  if (transactions.length === 0) {
    throw new Error('Group with no transactions');
  } else {
    result = transactions[0].updatedAt;
    for (const t of transactions) {
      if (t.updatedAt > result) {
        result = t.updatedAt;
      }
    }
  }
  return result;
}

function maxExecutedAt(transactions: Transaction[]): Date | undefined {
  let result: Date | undefined;
  if (transactions.length === 0) {
    throw new Error('Group with no transactions');
  } else {
    result = transactions[0].executedAt;
    for (const t of transactions) {
      if (t.executedAt > result) {
        result = t.executedAt;
      }
    }
  }
  return result;
}

function calculateStatusCodeForGroup(transactions: Transaction[]): number|undefined {
  let result: number|undefined;

  // Aggregates status codes for all transactions
  const allStatusCodes = new Set<number>();
  let undefinedStatusCodeCount = 0;
  for (const t of transactions) {
    if (t.statusCode) {
      allStatusCodes.add(t.statusCode);
    } else {
      undefinedStatusCodeCount += 1;
    }
  }
  if (allStatusCodes.size === 1 && undefinedStatusCodeCount === 0) {
    // Easy : all transactions have the same status code
    result = allStatusCodes.values().next().value
  } else {
    // We have a mix of status codes … to be refined later
    result = undefined;
  }

  return result;
}

function calculateStatusForGroup(transactions: Transaction[]): string|undefined {
  let result: string|undefined;

  // Aggregates status for all transactions
  const allStatuses = new Set<string>();
  for (const t of transactions) {
    allStatuses.add(t.status);
  }
  if (allStatuses.size === 1) {
    // Easy : all transactions have the same status
    result = allStatuses.values().next().value
  } else {
    // We have a mix of statuses … to be refined later
    result = undefined;
  }

  return result;
}
