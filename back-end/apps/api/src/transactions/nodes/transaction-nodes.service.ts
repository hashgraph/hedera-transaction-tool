import { Injectable } from '@nestjs/common';
import { TransactionStatus, TransactionType, User } from '@entities';
import { TransactionNodeDto } from '../dto';
import { TransactionNodeCollection } from '../dto/ITransactionNode';
import { TRANSACTION_STATUS_COLLECTIONS } from './transaction-node-collections.constants';
import {
  attachKeys,
  getTransactionNodesQuery,
  SqlBuilderService,
} from '@app/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

@Injectable()
export class TransactionNodesService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly sqlBuilder: SqlBuilderService,
  ) {}

  async getTransactionNodes(
    user: User,
    collection: TransactionNodeCollection,
    network: string,
    statusFilter: TransactionStatus[],
    transactionTypeFilter: TransactionType[],
  ): Promise<TransactionNodeDto[]> {
    let rows: any[];

    //this should already be done, imo, in the validation stuff
    await attachKeys(user, this.entityManager);
    if (user.keys.length === 0) {
      return [];
    }

    switch (collection) {
      case TransactionNodeCollection.READY_FOR_REVIEW: {
        const query = getTransactionNodesQuery(
          this.sqlBuilder,
          {
            statuses: TRANSACTION_STATUS_COLLECTIONS.READY_FOR_REVIEW,
            mirrorNetwork: network,
          },
          user,
          { approver: true }
        );

        rows = await this.entityManager.query(query.text, query.values);
        break;
      }
      case TransactionNodeCollection.READY_TO_SIGN: {
        const query = getTransactionNodesQuery(
          this.sqlBuilder,
          {
            statuses: TRANSACTION_STATUS_COLLECTIONS.READY_TO_SIGN,
            mirrorNetwork: network,
            onlyUnsigned: true,
          },
          user,
          { signer: true }
        );

        rows = await this.entityManager.query(query.text, query.values);
        break;
      }
      case TransactionNodeCollection.READY_FOR_EXECUTION: {
        const query = getTransactionNodesQuery(
          this.sqlBuilder,
          {
            statuses: TRANSACTION_STATUS_COLLECTIONS.READY_FOR_EXECUTION,
            mirrorNetwork: network,
          },
          user,
          {
            signer: true,
            creator: true,
            observer: true,
            approver: true,
          }
        );

        rows = await this.entityManager.query(query.text, query.values);
        break;
      }
      case TransactionNodeCollection.IN_PROGRESS: {
        const query = getTransactionNodesQuery(
          this.sqlBuilder,
          {
            statuses: TRANSACTION_STATUS_COLLECTIONS.IN_PROGRESS,
            mirrorNetwork: network,
          },
          user,
          {
            signer: true,
            creator: true,
            observer: true,
            approver: true,
          }
        );

        rows = await this.entityManager.query(query.text, query.values);
        break;
      }
      case TransactionNodeCollection.HISTORY: {
        statusFilter = statusFilter?.length ? statusFilter : TRANSACTION_STATUS_COLLECTIONS.HISTORY;
        transactionTypeFilter = transactionTypeFilter?.length ? transactionTypeFilter : null;
        const query = getTransactionNodesQuery(
          this.sqlBuilder,
          {
            statuses: statusFilter,
            types: transactionTypeFilter,
            mirrorNetwork: network,
          }
        );

        rows = await this.entityManager.query(query.text, query.values);
        break;
      }
    }

    return rows.map(row => {
      const node = new TransactionNodeDto();

      // These fields are always present
      node.description = row.description;
      node.createdAt = new Date(row.created_at).toISOString();
      node.validStart = new Date(row.valid_start).toISOString();
      node.updatedAt = new Date(row.updated_at).toISOString();
      node.executedAt = row.executed_at ? new Date(row.executed_at).toISOString() : undefined;
      node.status = row.status;
      node.statusCode = row.status_code;

      // Either transaction fields OR group fields
      if (row.group_id === null) {
        // Ungrouped transaction
        node.transactionId = row.transaction_id;
        node.groupId = undefined;
        node.sdkTransactionId = row.sdk_transaction_id;
        node.transactionType = row.transaction_type;
        node.isManual = row.is_manual;
        node.groupItemCount = undefined;
        node.groupCollectedCount = undefined;
      } else {
        // Grouped transactions
        node.transactionId = undefined;
        node.groupId = row.group_id;
        node.sdkTransactionId = undefined;
        node.transactionType = undefined;
        node.isManual = undefined;
        node.groupItemCount = row.group_item_count;
        node.groupCollectedCount = row.group_collected_count;
      }

      return node;
    });
  }
}
