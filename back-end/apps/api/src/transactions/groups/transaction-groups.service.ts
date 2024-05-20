import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionGroup, TransactionGroupItem } from '@entities';
import { Repository } from 'typeorm';
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
    const groupItems: TransactionGroupItem[] = [];

    for (const groupItemDto of dto.groupItems) {
      const transaction = await this.transactionsService.createTransaction(groupItemDto.transaction, user);
      const groupItem = this.itemRepo.create(groupItemDto);
      groupItem.transaction = transaction;
      groupItem.group = group;
      groupItems.push(await this.itemRepo.save(groupItem));
    }

    await this.repo.save(group);
    await this.itemRepo.save(groupItems);

    return group;
  }

  async removeTransactionGroup(user: UserDto, id: number): Promise<TransactionGroup> {
    const group = await this.repo.findOneBy({ id });
    if (!group) {
      throw new Error('group not found');
    }
    const groupItems = await this.itemRepo.find({
        relations: {
          group: true,
        },
        where: {
          group: {
            id: group.id,
          },
        },
      }
    );
    for (const groupItem of groupItems) {
      const transactionId = groupItem.transactionId;
      await this.itemRepo.remove(groupItem);
      await this.transactionsService.removeTransaction(user, transactionId, false);
    }
    return this.repo.remove(group);
  }
}
