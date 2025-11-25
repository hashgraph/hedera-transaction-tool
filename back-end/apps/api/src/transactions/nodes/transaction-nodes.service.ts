import { Injectable } from '@nestjs/common';
import { Transaction, TransactionStatus, User } from '@entities';
import {
  Filtering,
  PaginatedResourceDto,
  Pagination,
  Sorting,
} from '@app/common';
import { TransactionNodeDto } from '../dto';
import { TransactionNodeCollection } from '../../../../../../middle-end/src/ITransactionNode';
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
    pagination: Pagination,
    sorting?: Sorting[],
  ): Promise<PaginatedResourceDto<TransactionNodeDto>> {
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
          value: TransactionStatus.WAITING_FOR_EXECUTION,
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
    const nodes: TransactionNodeDto[] = [];
    for (const [groupId, transactions] of transactionsByGroup) {
      if (groupId === -1) {
        // transactions contains the single transactions
        for (const t of transactions) {
          const node = new TransactionNodeDto();
          node.transactionId = t.transactionId;
          node.groupId = undefined;
          node.description = t.description;
          node.validStart = t.validStart;
          node.updatedAt = t.updatedAt;
          node.itemCount = 0;
          nodes.push(node);
        }
      } else {
        const group = await this.transactionGroupsService.getTransactionGroup(user, groupId);
        const node = new TransactionNodeDto();
        node.transactionId = undefined;
        node.groupId = groupId;
        node.description = group.description;
        node.validStart = minValidStart(transactions);
        node.updatedAt = maxUpdatedAt(transactions);
        node.itemCount = transactions.length; // or group.items.length ?
        nodes.push(node);
      }
    }

    // Sort and paginates
    if (sorting) {
      console.log("To be implemented");
      // nodes.sort((n1, n2) => compareWithSorting(n1, n2, sorting));
    }
    const result: PaginatedResourceDto<TransactionNodeDto> = {
      totalItems: nodes.length,
      items: nodes.slice(pagination.offset, pagination.offset + pagination.limit),
      page: 0,
      size: pagination.size,
    };

    return Promise.resolve(result);
  }
}

function minValidStart(transactions: Transaction[]): Date | null {
  let result: Date | null;
  if (transactions.length === 0) {
    result = null;
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

function maxUpdatedAt(transactions: Transaction[]): Date | null {
  let result: Date | null;
  if (transactions.length === 0) {
    result = null;
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
