import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionObserver } from '../../entities/transaction-observer.entity';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { CreateTransactionObserverDto } from '../dto/create-transaction-observer.dto';
import { UpdateTransactionObserverDto } from '../dto/update-transaction-observer.dto';

@Injectable()
export class ObserversService {
  constructor(
    @InjectRepository(TransactionObserver)
    private repo: Repository<TransactionObserver>,
  ) {}

  async createTransactionObserver(
    transactionId: number,
    dto: CreateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    const observer = await this.repo.create(dto);
    observer['transaction' as any] = transactionId;
    return this.repo.save(observer);
  }

  getTransactionObserversByUserId(
    userId: number,
  ): Promise<TransactionObserver[]> {
    return this.repo
      .createQueryBuilder('observer')
      .leftJoinAndSelect('observer.transaction', 'transaction')
      .leftJoinAndSelect('observer.user', 'user')
      .where('user.id = :userId', { userId })
      .getMany();
  }

  getTransactionObserversByTransactionId(
    transactionId: number,
  ): Promise<TransactionObserver[]> {
    return this.repo
      .createQueryBuilder('observer')
      .leftJoinAndSelect('observer.user', 'user')
      .leftJoinAndSelect('observer.transaction', 'transaction')
      .where('transaction.id = :transactionId', { transactionId })
      .getMany();
  }

  getTransactionObserverById(id: number): Promise<TransactionObserver> {
    if (!id) {
      return null;
    }
    return this.repo.findOne({
      relations: ['transaction', 'user'],
      where: { id },
    });
  }

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

  async removeTransactionObserver(id: number): Promise<TransactionObserver> {
    const observer = await this.getTransactionObserverById(id);
    if (!observer) {
      throw new NotFoundException('transaction observer not found');
    }
    return this.repo.remove(observer);
  }
}
