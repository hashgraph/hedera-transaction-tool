import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Role, Transaction, TransactionObserver, User } from '@entities';

import { CreateTransactionObserversDto, UpdateTransactionObserverDto } from '../dto';

@Injectable()
export class ObserversService {
  constructor(
    @InjectRepository(TransactionObserver)
    private repo: Repository<TransactionObserver>,
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
  ) {}

  /* Create transaction observers for the given transaction id with the user ids */
  async createTransactionObservers(
    user: User,
    transactionId: number,
    dto: CreateTransactionObserversDto,
  ): Promise<TransactionObserver[]> {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user'],
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    if (transaction.creatorKey?.user?.id !== user.id)
      throw new UnauthorizedException('Only the creator of the transaction is able to delete it');

    const observers: TransactionObserver[] = [];

    for (const userId of dto.userIds) {
      const observer = this.repo.create({ userId, transactionId, role: Role.FULL });
      observers.push(observer);
    }

    try {
      return await this.repo.save(observers);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /* Get all transaction observers for the given transaction id. */
  async getTransactionObserversByTransactionId(
    transactionId: number,
    user: User,
  ): Promise<TransactionObserver[]> {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user', 'observers', 'approvers'],
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    if (
      !transaction.observers.some(o => o.userId === user.id) &&
      transaction.creatorKey?.user?.id !== user.id
      // || transaction.approvers.some(a => a. === user.id
    )
      throw new UnauthorizedException("You don't have permission to view this transaction");

    return transaction.observers;
  }

  /* Update a transaction observer with the data provided for the given observer id. */
  async updateTransactionObserver(
    id: number,
    dto: UpdateTransactionObserverDto,
    user: User,
  ): Promise<TransactionObserver> {
    const observer = await this.getUpdateableObserver(id, user);

    Object.assign(observer, dto);
    return this.repo.save(observer);
  }

  /* Remove the transaction observer for the given transaction observer id. */
  async removeTransactionObserver(id: number, user: User): Promise<TransactionObserver> {
    const observer = await this.getUpdateableObserver(id, user);

    return this.repo.remove(observer);
  }

  /* Helper function to get the observer and verify that the user has permission to update it. */
  private async getUpdateableObserver(id: number, user: User): Promise<TransactionObserver> {
    const observer = await this.repo.findOneBy({ id });

    if (!observer) throw new NotFoundException('Transaction observer not found');

    const transaction = await this.transactionRepo.findOne({
      where: { id: observer.transactionId },
      relations: ['creatorKey', 'creatorKey.user'],
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    if (transaction.creatorKey?.user?.id !== user.id)
      throw new UnauthorizedException('Only the creator of the transaction is able to update it');

    return observer;
  }
}
