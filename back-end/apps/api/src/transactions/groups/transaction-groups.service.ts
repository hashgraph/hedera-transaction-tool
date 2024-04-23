import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction, TransactionGroup, TransactionGroupItem } from '@entities';
import { getManager, Repository } from 'typeorm';
import { CreateTransactionGroupDto } from '../dto';
import { TransactionsService } from '../transactions.service';
import { UserDto } from '../../users/dtos';

@Injectable()
export class TransactionGroupsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectRepository(TransactionGroup) private readonly repo: Repository<TransactionGroup>,
    @InjectRepository(TransactionGroupItem) private readonly itemRepo: Repository<TransactionGroupItem>,
  ) {}

  getTransactionGroups(): Promise<TransactionGroup[]> {
    return this.repo.find();
  }

  async createTransactionGroup(user: UserDto, dto: CreateTransactionGroupDto): Promise<TransactionGroup> {
    const group = this.repo.create(dto);
    const transactions: Transaction[] = [];
    const groupItems: TransactionGroupItem[] = [];

    for (const groupItemDto of dto.groupItems) {
      const transaction = await this.transactionsService.createTransaction(groupItemDto.transaction, user);
      transactions.push(transaction);
      const groupItem = this.itemRepo.create(groupItemDto);
      groupItem.transaction = transaction;
      groupItem.group = group;
      groupItems.push(await this.itemRepo.save(groupItem));
    }

    //TODO transactions not rollingback. Not sure how to get the proper EntityManager. This didn't work
    // neither did repo.manager. repo.manager seems to return the global manager, which is not ok either.
    // Need to make this work.
    const successful = await getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(transactions);
      await transactionalEntityManager.save(group);
      await transactionalEntityManager.save(groupItems);
      return true;
    });

    return group;
  }

  async removeTransactionGroup(id: number): Promise<TransactionGroup> {
    const group = await this.repo.findOneBy({ id });
    if (!group) {
      throw new Error('group not found');
    }
    const groupItems = await this.itemRepo.findBy({ group });
    await this.itemRepo.remove(groupItems);
    for (const groupItem of groupItems) {
      await this.transactionsService.removeTransaction(groupItem.transactionId);
    }
    return this.repo.remove(group);
  }
}
