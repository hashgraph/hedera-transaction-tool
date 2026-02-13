import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  asyncFilter,
  emitTransactionStatusUpdate,
  emitTransactionUpdate,
  ErrorCodes,
  NatsPublisherService,
} from '@app/common';
import { TransactionGroup, TransactionGroupItem, User } from '@entities';

import { TransactionsService } from '../transactions.service';

import { CreateTransactionGroupDto } from '../dto';

@Injectable()
export class TransactionGroupsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectDataSource() private dataSource: DataSource,
    private readonly notificationsPublisher: NatsPublisherService,
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

  async getTransactionGroup(user: User, id: number): Promise<TransactionGroup> {
    const group = await this.dataSource.manager.findOne(TransactionGroup, {
      where: { id },
      relations: [
        'groupItems',
        'groupItems.transaction',
        'groupItems.transaction.creatorKey',
        'groupItems.transaction.observers',
      ],
    });

    if (!(group?.groupItems?.length > 0)) {
      throw new BadRequestException(ErrorCodes.TNF);
    }

    group.groupItems = await asyncFilter(group.groupItems, async groupItem => {
      await this.transactionsService.attachTransactionSigners(groupItem.transaction);
      await this.transactionsService.attachTransactionApprovers(groupItem.transaction);
      return this.transactionsService.verifyAccess(groupItem.transaction, user);
    });

    if (group.groupItems.length === 0) {
      throw new UnauthorizedException("You don't have permission to view this group.");
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
}
