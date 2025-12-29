import { Injectable } from '@nestjs/common';
import { Transaction, TransactionStatus, TransactionType, User } from '@entities';
import {
  Filtering,
  MirrorNodeService,
  Pagination,
  produceSigningReport,
  produceSigningReportForArray,
} from '@app/common';
import { TransactionNodeDto } from '../dto';
import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { TransactionsService } from '../transactions.service';
import { TransactionGroupsService } from '../groups';
import { compareTransactionNodes } from './transaction-nodes.util';
import { Transaction as SDKTransaction } from '@hashgraph/sdk/lib/exports';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
    private readonly mirrorNodeService: MirrorNodeService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getTransactionNodes(
    user: User,
    collection: TransactionNodeCollection,
    network: string,
    statusFilter: TransactionStatus[],
    transactionTypeFilter: TransactionType[],
  ): Promise<TransactionNodeDto[]> {
    let transactions: Transaction[];
    const filter: Filtering = {
      property: 'mirrorNetwork',
      rule: 'eq',
      value: network,
    };
    switch (collection) {
      case TransactionNodeCollection.READY_FOR_REVIEW: {
        const p = await this.transactionsService.getTransactionsToApprove(
          user,
          PAGINATION_ALL,
          undefined,
          [filter],
        );
        transactions = p.items;
        break;
      }
      case TransactionNodeCollection.READY_TO_SIGN: {
        const r = await this.transactionsService.getTransactionsToSign(
          user,
          PAGINATION_ALL,
          undefined,
          [filter],
        );
        transactions = r.items.map(v => v.transaction);
        break;
      }
      case TransactionNodeCollection.READY_FOR_EXECUTION: {
        const filterExecution: Filtering = {
          property: 'status',
          rule: 'eq',
          value: TransactionStatus.WAITING_FOR_EXECUTION,
        };
        const p = await this.transactionsService.getTransactions(user, PAGINATION_ALL, undefined, [
          filter,
          filterExecution,
        ]);
        transactions = p.items;
        break;
      }
      case TransactionNodeCollection.IN_PROGRESS: {
        const filterProgress: Filtering = {
          property: 'status',
          rule: 'eq',
          value: TransactionStatus.WAITING_FOR_SIGNATURES,
        };
        const p = await this.transactionsService.getTransactions(user, PAGINATION_ALL, undefined, [
          filter,
          filterProgress,
        ]);
        transactions = p.items;
        break;
      }
      case TransactionNodeCollection.HISTORY: {
        const p = await this.transactionsService.getHistoryTransactions(PAGINATION_ALL, [filter]);
        transactions = p.items;
        break;
      }
    }

    // Filters
    if (statusFilter.length > 0) {
      transactions = transactions.filter((t: Transaction) => statusFilter.includes(t.status));
    }
    if (transactionTypeFilter.length > 0) {
      transactions = transactions.filter((t: Transaction) =>
        transactionTypeFilter.includes(t.type),
      );
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
          const signingReport = await produceSigningReport(
            t,
            this.mirrorNodeService,
            network,
            this.dataSource.manager,
          );
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
          node.isManual = t.isManual;
          node.groupItemCount = undefined;
          node.groupCollectedCount = undefined;
          node.internalSignerCount = signingReport.internalSigners.size;
          node.externalSignerCount = signingReport.externalSigners.size;
          node.internalSignatureCount = signingReport.internalSignatures.size;
          node.externalSignatureCount = signingReport.externalSignatures.size;
          node.unexpectedSignatureCount = signingReport.unexpectedSignatures.size;
          result.push(node);
        }
      } else {
        const group = await this.transactionGroupsService.getTransactionGroup(user, groupId);
        const signingReport = await produceSigningReportForArray(
          transactions,
          this.mirrorNodeService,
          network,
          this.dataSource.manager,
        );
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
        node.isManual = undefined;
        node.groupItemCount = group.groupItems.length;
        node.groupCollectedCount = transactions.length;
        node.internalSignerCount = signingReport.internalSigners.size;
        node.externalSignerCount = signingReport.externalSigners.size;
        node.internalSignatureCount = signingReport.internalSignatures.size;
        node.externalSignatureCount = signingReport.externalSignatures.size;
        node.unexpectedSignatureCount = signingReport.unexpectedSignatures.size;
        result.push(node);
      }
    }

    // We sort by node.transactionId / node.groupId
    // => stable order will help in testing.
    result.sort(compareTransactionNodes);

    return result;
  }
}

export function minValidStart(transactions: Transaction[]): Date {
  let result: Date;
  if (transactions.length === 0) {
    throw new Error('Group with no transactions');
  } else {
    // transactions contains at least one element
    result = transactions[0].validStart;
    for (const t of transactions) {
      if (t.validStart.getTime() < result.getTime()) {
        result = t.validStart;
      }
    }
  }
  return result;
}

export function maxUpdatedAt(transactions: Transaction[]): Date {
  let result: Date;
  if (transactions.length === 0) {
    throw new Error('Group with no transactions');
  } else {
    result = transactions[0].updatedAt;
    for (const t of transactions) {
      if (t.updatedAt.getTime() > result.getTime()) {
        result = t.updatedAt;
      }
    }
  }
  return result;
}

export function maxExecutedAt(transactions: Transaction[]): Date | undefined {
  let result: Date | undefined;
  if (transactions.length === 0) {
    throw new Error('Group with no transactions');
  } else if (transactions.find(t => !t.executedAt)) {
    // If one a transactions has undefined executedAt, we return undefined
    result = undefined;
  } else {
    result = undefined;
    for (const t of transactions) {
      if (result === undefined || t.executedAt!.getTime() > result.getTime()) {
        result = t.executedAt;
      }
    }
  }
  return result;
}

function calculateStatusCodeForGroup(transactions: Transaction[]): number | undefined {
  let result: number | undefined;

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
    result = allStatusCodes.values().next().value;
  } else {
    // We have a mix of status codes … to be refined later
    result = undefined;
  }

  return result;
}

function calculateStatusForGroup(transactions: Transaction[]): string | undefined {
  let result: string | undefined;

  // Aggregates status for all transactions
  const allStatuses = new Set<string>();
  for (const t of transactions) {
    allStatuses.add(t.status);
  }
  if (allStatuses.size === 1) {
    // Easy : all transactions have the same status
    result = allStatuses.values().next().value;
  } else {
    // We have a mix of statuses … to be refined later
    result = undefined;
  }

  return result;
}
