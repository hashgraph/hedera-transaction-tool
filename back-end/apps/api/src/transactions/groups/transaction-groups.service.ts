import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  emitTransactionStatusUpdate,
  emitTransactionUpdate,
  ErrorCodes,
  getTransactionGroupItemsQuery,
  NatsPublisherService,
  SqlBuilderService,
} from '@app/common';
import { Transaction, TransactionGroup, TransactionGroupItem, User, UserKey } from '@entities';

import { TransactionsService } from '../transactions.service';

import { CreateTransactionGroupDto } from '../dto';

@Injectable()
export class TransactionGroupsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectDataSource() private dataSource: DataSource,
    private readonly notificationsPublisher: NatsPublisherService,
    private readonly sqlBuilder: SqlBuilderService,
  ) {}

  getTransactionGroups(): Promise<TransactionGroup[]> {
    return this.dataSource.manager.find(TransactionGroup);
  }

  async createTransactionGroup(
    user: User,
    dto: CreateTransactionGroupDto,
  ): Promise<TransactionGroup> {
    const group = this.dataSource.manager.create(TransactionGroup, dto);

    // Extract all transaction DTOs
    const transactionDtos = dto.groupItems.map(item => item.transaction);

    // Batch create all transactions
    const transactions = await this.transactionsService.createTransactions(
      transactionDtos,
      user,
    );

    await this.dataSource.transaction(async manager => {
      // Create group items with corresponding transactions
      const groupItems = transactions.map((transaction, index) => {
        const groupItemDto = dto.groupItems[index];
        const groupItem = manager.create(TransactionGroupItem, groupItemDto);
        groupItem.transaction = transaction;
        groupItem.group = group;
        return groupItem;
      });

      // Save everything
      await manager.save(TransactionGroup, group);
      await manager.save(TransactionGroupItem, groupItems);

      emitTransactionStatusUpdate(
        this.notificationsPublisher,
        transactions.map(tx => ({
          entityId: tx.id,
        })),
      );
    });

    return group;
  }

  async getTransactionGroup(user: User, id: number, full?: boolean): Promise<TransactionGroup> {
    const group = await this.dataSource.manager.findOne(TransactionGroup, {
      where: { id },
    });

    if (!group) {
      throw new BadRequestException(ErrorCodes.TNF);
    }

    const query = getTransactionGroupItemsQuery(this.sqlBuilder, id, user);

    const rows = await this.dataSource.manager.query(
      query.text,
      query.values,
    );

    group.groupItems = rows.map(row => {
      const creator = this.dataSource.manager.create(User, {
        id: row.tx_creator_key_user_id,
        email: row.tx_creator_email,
      });

      const creatorKey = this.dataSource.manager.create(UserKey, {
        id: row.tx_creator_key_id,
        userId: row.tx_creator_key_user_id,
        user: creator,
      });

      const transaction = this.dataSource.manager.create(Transaction, {
        id: row.tx_id,
        name: row.tx_name,
        type: row.tx_type,
        description: row.tx_description,
        transactionId: row.sdk_transaction_id,
        transactionHash: row.tx_transaction_hash,
        transactionBytes: row.tx_transaction_bytes,
        unsignedTransactionBytes: row.tx_unsigned_transaction_bytes,
        status: row.tx_status,
        statusCode: row.tx_status_code,
        creatorKeyId: row.tx_creator_key_id,
        creatorKey,
        signature: row.tx_signature,
        validStart: row.tx_valid_start,
        mirrorNetwork: row.tx_mirror_network,
        isManual: row.tx_is_manual,
        cutoffAt: row.tx_cutoff_at,
        createdAt: row.tx_created_at,
        executedAt: row.tx_executed_at,
        updatedAt: row.tx_updated_at,
      });

      return this.dataSource.manager.create(TransactionGroupItem, {
        seq: row.gi_seq,
        groupId: id,
        transactionId: row.tx_id,
        transaction,
      });
    });

    if (group.groupItems.length === 0) {
      throw new UnauthorizedException("You don't have permission to view this group.");
    }

    if (!full) return group;

    const transactionIds = group.groupItems.map(item => item.transactionId);

    const [
      transactionSigners,
      transactionApprovers,
      transactionObservers,
    ] = await Promise.all([
      this.transactionsService.getTransactionSignersForTransactions(transactionIds),
      this.transactionsService.getTransactionApproversForTransactions(transactionIds),
      this.transactionsService.getTransactionObserversForTransactions(transactionIds),
    ]);

    const signerMap = this.groupBy(transactionSigners, s => s.transactionId);
    const approverMap = this.groupBy(transactionApprovers, a => a.transactionId);
    const observerMap = this.groupBy(transactionObservers, o => o.transactionId);

    for (const groupItem of group.groupItems) {
      const txId = groupItem.transactionId;

      groupItem.transaction.signers = signerMap.get(txId) ?? [];
      groupItem.transaction.approvers = approverMap.get(txId) ?? [];
      groupItem.transaction.observers = observerMap.get(txId) ?? [];
    }

    return group;
  }

  async removeTransactionGroup(user: User, id: number): Promise<boolean> {
    const group = await this.dataSource.manager.findOneBy(TransactionGroup, { id });
    if (!group) {
      throw new Error('group not found');
    }
    const groupItems = await this.dataSource.manager.find(TransactionGroupItem, {
      relations: {
        group: true,
      },
      where: {
        group: {
          id: group.id,
        },
      },
    });
    for (const groupItem of groupItems) {
      const transactionId = groupItem.transactionId;
      await this.dataSource.manager.remove(TransactionGroupItem, groupItem);
      await this.transactionsService.removeTransaction(transactionId, user, false);
    }

    await this.dataSource.manager.remove(TransactionGroup, group);

    emitTransactionUpdate(this.notificationsPublisher, groupItems.map(gi => ({ entityId: gi.transactionId })));

    return true;
  }

  private groupBy<T>(
    items: T[],
    key: (item: T) => string | number,
  ) {
    const map = new Map<string | number, T[]>();

    for (const item of items) {
      const k = key(item);
      if (!map.has(k)) {
        map.set(k, []);
      }
      map.get(k)!.push(item);
    }

    return map;
  }
}
