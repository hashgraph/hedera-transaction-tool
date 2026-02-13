import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';

import { EntityManager, Repository } from 'typeorm';

import { Role, Transaction, TransactionObserver, TransactionStatus, User } from '@entities';

import {
  TransactionSignatureService,
  NatsPublisherService,
  userKeysRequiredToSign,
  ErrorCodes,
  emitTransactionUpdate,
} from '@app/common';

import { ApproversService } from '../approvers';

import { CreateTransactionObserversDto, UpdateTransactionObserverDto } from '../dto';

@Injectable()
export class ObserversService {
  constructor(
    @InjectRepository(TransactionObserver)
    private repo: Repository<TransactionObserver>,
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly approversService: ApproversService,
    private readonly transactionSignatureService: TransactionSignatureService,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {}

  /* Create transaction observers for the given transaction id with the user ids */
  async createTransactionObservers(
    user: User,
    transactionId: number,
    dto: CreateTransactionObserversDto,
  ): Promise<TransactionObserver[]> {
    const transaction = await this.entityManager.findOne(Transaction, {
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user', 'observers'],
    });

    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    if (transaction.creatorKey?.userId !== user.id)
      throw new UnauthorizedException('Only the creator of the transaction is able to delete it');

    const observers: TransactionObserver[] = [];

    for (const userId of dto.userIds) {
      if (!transaction.observers.some(o => o.userId === userId)) {
        const observer = this.repo.create({ userId, transactionId, role: Role.FULL });
        observers.push(observer);
      }
    }

    if (observers.length === 0) {
      return [];
    }

    try {
      const result = await this.repo.save(observers);

      emitTransactionUpdate(this.notificationsPublisher, [{ entityId: transactionId }]);

      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /* Get all transaction observers for the given transaction id. */
  async getTransactionObserversByTransactionId(
    transactionId: number,
    user: User,
  ): Promise<TransactionObserver[]> {
    const transaction = await this.entityManager.findOne(Transaction, {
      where: { id: transactionId },
      relations: ['creatorKey', 'observers', 'signers', 'signers.userKey'],
    });

    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    const userKeysToSign = await userKeysRequiredToSign(
      transaction,
      user,
      this.transactionSignatureService,
      this.entityManager,
    );

    const approvers = await this.approversService.getApproversByTransactionId(transaction.id);

    if (
      [
        TransactionStatus.EXECUTED,
        TransactionStatus.EXPIRED,
        TransactionStatus.FAILED,
        TransactionStatus.CANCELED,
        TransactionStatus.ARCHIVED,
      ].includes(transaction.status)
    )
      return transaction.observers;

    if (
      userKeysToSign.length === 0 &&
      transaction.creatorKey?.userId !== user.id &&
      !transaction.observers.some(o => o.userId === user.id) &&
      !transaction.signers.some(s => s.userKey?.userId === user.id) &&
      !approvers.some(a => a.userId === user.id)
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

    const result = await this.repo.save(observer);

    emitTransactionUpdate(this.notificationsPublisher, [{ entityId: observer.transactionId }]);

    return result;
  }

  /* Remove the transaction observer for the given transaction observer id. */
  async removeTransactionObserver(id: number, user: User): Promise<boolean> {
    const observer = await this.getUpdateableObserver(id, user);

    await this.repo.remove(observer);

    emitTransactionUpdate(this.notificationsPublisher, [{ entityId: observer.transactionId }]);

    return true;
  }

  /* Helper function to get the observer and verify that the user has permission to update it. */
  private async getUpdateableObserver(id: number, user: User): Promise<TransactionObserver> {
    const observer = await this.repo.findOneBy({ id });

    if (!observer) throw new BadRequestException(ErrorCodes.ONF);

    const transaction = await this.entityManager.findOne(Transaction, {
      where: { id: observer.transactionId },
      relations: ['creatorKey', 'creatorKey.user'],
    });

    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    if (transaction.creatorKey?.userId !== user.id)
      throw new UnauthorizedException('Only the creator of the transaction is able to update it');

    return observer;
  }
}
