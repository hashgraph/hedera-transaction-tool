import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

import { CancelTransactionOutcome, TransactionsService } from '../transactions.service';

import {
  CancelFailureCode,
  CancelGroupResultDto,
  CreateTransactionGroupDto,
} from '../dto';

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

  async cancelTransactionGroup(
    user: User,
    groupId: number,
  ): Promise<CancelGroupResultDto> {
    const group = await this.getTransactionGroup(user, groupId);

    // Verify the user is the creator of the group's transactions
    const firstTransaction = group.groupItems[0]?.transaction;
    if (firstTransaction && firstTransaction.creatorKey?.userId !== user.id) {
      throw new UnauthorizedException('Only the creator can cancel all transactions in a group.');
    }

    const canceled: number[] = [];
    const alreadyCanceled: number[] = [];
    const failed: { id: number; code: CancelFailureCode; message: string }[] = [];

    // Process in batches to avoid DB connection pool exhaustion
    const BATCH_SIZE = 10;
    for (let i = 0; i < group.groupItems.length; i += BATCH_SIZE) {
      const batch = group.groupItems.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (groupItem) => {
          const txId = groupItem.transactionId;
          const outcome = await this.transactionsService.cancelTransactionWithOutcome(txId, user);
          return { txId, outcome };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          const { txId, outcome } = result.value;
          if (outcome === CancelTransactionOutcome.ALREADY_CANCELED) {
            alreadyCanceled.push(txId);
          } else {
            canceled.push(txId);
          }
        } else {
          const txId = batch[j].transactionId;
          failed.push(this.mapCancelError(txId, result.reason));
        }
      }
    }

    return {
      canceled,
      alreadyCanceled,
      failed,
      summary: {
        processedCount: group.groupItems.length,
        canceled: canceled.length,
        alreadyCanceled: alreadyCanceled.length,
        failed: failed.length,
      },
    };
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

  private mapCancelError(
    id: number,
    error: unknown,
  ): { id: number; code: CancelFailureCode; message: string } {
    if (error instanceof UnauthorizedException) {
      return {
        id,
        code: CancelFailureCode.FORBIDDEN,
        message: 'You do not have permission to cancel this transaction.',
      };
    }

    if (error instanceof ConflictException) {
      return {
        id,
        code: CancelFailureCode.CONFLICT,
        message: 'Transaction state changed during cancellation.',
      };
    }

    if (error instanceof BadRequestException) {
      const errorCode = this.extractBadRequestCode(error);
      if (errorCode === ErrorCodes.OTIP) {
        return {
          id,
          code: CancelFailureCode.NOT_CANCELABLE,
          message: 'Transaction cannot be canceled in its current state.',
        };
      }

      if (errorCode === ErrorCodes.TNF) {
        return {
          id,
          code: CancelFailureCode.NOT_FOUND,
          message: 'Transaction was not found.',
        };
      }
    }

    return {
      id,
      code: CancelFailureCode.INTERNAL_ERROR,
      message: 'Cancellation failed due to an unexpected error.',
    };
  }

  private extractBadRequestCode(error: BadRequestException): string | null {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.find(m => typeof m === 'string') ?? null;
      }
      if (typeof message === 'string') {
        return message;
      }
    }

    return null;
  }
}
