import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionObserver } from '@entities/';
import { Repository } from 'typeorm';
import { CreateTransactionObserverDto } from '../dto/create-transaction-observer.dto';
import { UpdateTransactionObserverDto } from '../dto/update-transaction-observer.dto';

@Injectable()
export class ObserversService {
  constructor(
    @InjectRepository(TransactionObserver)
    private repo: Repository<TransactionObserver>,
  ) {}

  // Create a transaction observer for the given transaction id with the provided data.
  async createTransactionObserver(
    transactionId: number,
    dto: CreateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    const observer = this.repo.create(dto);
    observer['transaction' as any] = transactionId;
    return this.repo.save(observer);
  }

  //TODO How/When would this be used?
  getTransactionObserversByUserId(userId: number): Promise<TransactionObserver[]> {
    return this.repo
      .createQueryBuilder('observer')
      .leftJoinAndSelect('observer.transaction', 'transaction')
      .leftJoinAndSelect('observer.user', 'user')
      .where('user.id = :userId', { userId })
      .getMany();
  }

  // Get all transaction observers for the given transaction id.
  // Include the transaction and user information in the response.
  getTransactionObserversByTransactionId(transactionId: number): Promise<TransactionObserver[]> {
    return this.repo
      .createQueryBuilder('observer')
      .leftJoinAndSelect('observer.user', 'user')
      .leftJoinAndSelect('observer.transaction', 'transaction')
      .where('transaction.id = :transactionId', { transactionId })
      .getMany();
  }

  // Get the transaction observer for the given transaction observer id.
  // Include the transaction and user information in the response.
  getTransactionObserverById(id: number): Promise<TransactionObserver> {
    if (!id) {
      return null;
    }
    return this.repo.findOne({
      relations: ['transaction', 'user'],
      where: { id },
    });
  }

  // Update a transaction observer with the data provided for the given observer id.
  async updateTransactionObserver(
    id: number,
    dto: UpdateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    const observer = await this.getTransactionObserverById(id);
    if (!observer) {
      throw new NotFoundException('transaction observer not found');
    }
    Object.assign(observer, dto);
    return this.repo.save(observer);
  }

  // Remove the transaction observer for the given transaction observer id.
  async removeTransactionObserver(id: number): Promise<TransactionObserver> {
    const observer = await this.getTransactionObserverById(id);
    if (!observer) {
      throw new NotFoundException('transaction observer not found');
    }
    return this.repo.remove(observer);
  }
}
