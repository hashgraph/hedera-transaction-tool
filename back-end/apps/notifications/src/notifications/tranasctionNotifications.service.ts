import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import { keysRequiredToSign, MirrorNodeService, NotifyForTransactionDto } from '@app/common';
import { Transaction, User } from '@entities';

import { EmailService } from '../email/email.service';

@Injectable()
export class TransactionNotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly mirrorNodeService: MirrorNodeService,
    @InjectEntityManager() private entityManager: EntityManager,
  ) {}

  async notifyTransactionRequiredSigners(dto: NotifyForTransactionDto) {
    /* Get transaction */
    const transaction = await this.entityManager.findOne(Transaction, {
      where: {
        id: dto.transactionId,
      },
    });

    if (!transaction) throw new Error('Transaction not found');

    const allKeys = await keysRequiredToSign(
      transaction,
      this.mirrorNodeService,
      this.entityManager,
    );

    const distinctUserIds = allKeys.map(k => k.userId).filter((v, i, a) => a.indexOf(v) === i);

    /* Get users by keys */
    const users = await this.entityManager.find(User, {
      where: {
        id: In(distinctUserIds),
      },
    });
    const emails = users.map(u => u.email);

    if (emails.length > 0) {
      this.emailService.notifyEmail({
        subject: 'Hedera Transaction Tool | Transaction to sign',
        email: emails,
        text: `You have a transaction to sign. Please visit the Hedera Transaction Tool to sign the transaction ${transaction.transactionId}.`,
      });
    }
  }

  async notifyTransactionCreatorOnReadyForExecution(dto: NotifyForTransactionDto) {
    /* Get transaction */
    const transaction = await this.entityManager.findOne(Transaction, {
      where: {
        id: dto.transactionId,
      },
      relations: {
        creatorKey: {
          user: true,
        },
      },
    });

    if (!transaction) throw new Error('Transaction not found');

    /* Get user */
    const user = await this.entityManager.findOne(User, {
      where: {
        id: transaction.creatorKey?.user?.id,
      },
    });

    if (!user) throw new Error('User not found');

    if (user.email) {
      this.emailService.notifyEmail({
        subject: 'Hedera Transaction Tool | Transaction ready for execution',
        email: user.email,
        text: `Your transaction ${transaction.transactionId} is ready for execution.`,
      });
    }
  }
}
