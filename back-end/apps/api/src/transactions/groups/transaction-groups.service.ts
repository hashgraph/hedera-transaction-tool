import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  asyncFilter,
  ErrorCodes,
  NOTIFICATIONS_SERVICE,
  notifyTransactionAction,
} from '@app/common';
import { TransactionGroup, TransactionGroupItem, User } from '@entities';

import { TransactionsService } from '../transactions.service';

import { CreateTransactionGroupDto } from '../dto';

@Injectable()
export class TransactionGroupsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectDataSource() private dataSource: DataSource,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
  ) {}

  getTransactionGroups(): Promise<TransactionGroup[]> {
    return this.dataSource.manager.find(TransactionGroup);
  }

  async createTransactionGroup(
    user: User,
    dto: CreateTransactionGroupDto,
  ): Promise<TransactionGroup> {
    const group = this.dataSource.manager.create(TransactionGroup, dto);

    await this.dataSource.transaction(async manager => {
      const groupItems: TransactionGroupItem[] = [];

      for (const groupItemDto of dto.groupItems) {
        const transaction = await this.transactionsService.createTransaction(
          groupItemDto.transaction,
          user,
        );
        const groupItem = manager.create(TransactionGroupItem, groupItemDto);

        groupItem.transaction = transaction;
        groupItem.group = group;
        groupItems.push(await manager.save(TransactionGroupItem, groupItem));
      }

      await manager.save(TransactionGroup, group);
      await manager.save(TransactionGroupItem, groupItems);
    });

    notifyTransactionAction(this.notificationsService);

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
      throw new NotFoundException(ErrorCodes.TNF);
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

    notifyTransactionAction(this.notificationsService);

    return true;
  }
}
