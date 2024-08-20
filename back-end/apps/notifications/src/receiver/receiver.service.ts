import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import {
  keysRequiredToSign,
  MirrorNodeService,
  NotifyForTransactionDto,
  NotifyGeneralDto,
} from '@app/common';
import { NotificationPreferencesOptions, Transaction, User } from '@entities';

import { EmailService } from '../email/email.service';

@Injectable()
export class ReceiverService {
  constructor(
    private readonly emailService: EmailService,
    private readonly mirrorNodeService: MirrorNodeService,
    @InjectEntityManager() private entityManager: EntityManager,
  ) {}

  async notifyGeneral(dto: NotifyGeneralDto) {}

  async notifyTransactionRequiredSigners(dto: NotifyForTransactionDto) {
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

    const allKeys = await keysRequiredToSign(
      transaction,
      this.mirrorNodeService,
      this.entityManager,
    );

    const distinctUserIds = allKeys
      .map(k => k.userId)
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(id => id !== transaction.creatorKey?.user?.id)
      .filter(Boolean);

    /* Get users by keys */
    const users = await this.entityManager.find(User, {
      where: {
        id: In(distinctUserIds),
      },
      relations: {
        notificationPreferences: true,
      },
    });

    const emails = this.filterByNotificationPreferences(users, 'transactionRequiredSignature').map(
      u => u.email,
    );

    if (emails.length > 0) {
      this.emailService.notifyEmail({
        subject: 'Action Required: Review and Sign Transaction',
        email: emails,
        text: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction using the following ID: ${transaction.transactionId}.`,
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
    let user = await this.entityManager.findOne(User, {
      where: {
        id: transaction.creatorKey?.user?.id,
      },
      relations: {
        notificationPreferences: true,
      },
    });

    if (!user) throw new Error('User not found');

    [user] = this.filterByNotificationPreferences([user], 'transactionReadyForExecution');

    if (user && user.email) {
      this.emailService.notifyEmail({
        subject: 'Hedera Transaction Tool | Transaction ready for execution',
        email: user.email,
        text: `Your transaction ${transaction.transactionId} is ready for execution.`,
      });
    }
  }

  filterByNotificationPreferences(
    users: User[],
    notificationType: keyof NotificationPreferencesOptions,
  ) {
    return users.filter(u => {
      if (!u.notificationPreferences || u.notificationPreferences[notificationType]) return true;

      return false;
    });
  }
}
