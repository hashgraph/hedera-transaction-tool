import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  emitReviewerRejection,
  emitTransactionStatusUpdate,
  ErrorCodes,
  NatsPublisherService,
} from '@app/common';
import {
  Transaction,
  TransactionReviewerList,
  TransactionReviewerListMember,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';

import { ReviewActionDto } from '../dto';

@Injectable()
export class ReviewersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {}

  async submitReview(transactionId: number, dto: ReviewActionDto, user: User): Promise<void> {
    const transaction = await this.dataSource.manager.findOne(Transaction, {
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException(ErrorCodes.TNF);

    if (transaction.status !== TransactionStatus.READY_FOR_REVIEW) {
      throw new ConflictException(ErrorCodes.TRPC);
    }

    const pendingMembers = await this.findPendingMembers(transactionId, user.id);
    if (pendingMembers.length === 0) {
      throw new ForbiddenException(ErrorCodes.RNPF);
    }

    if (dto.accepted) {
      await this.validateKeyAvailability(pendingMembers, user.id);
    }

    await this.dataSource.transaction(async em => {
      await em
        .createQueryBuilder()
        .update(TransactionReviewerListMember)
        .set({
          accepted: dto.accepted,
          note: dto.note ?? null,
          actionedAt: new Date(),
        })
        .whereInIds(pendingMembers.map(m => m.id))
        .execute();
    });

    if (dto.accepted) {
      const allSatisfied = await this.allListsSatisfied(transactionId);
      if (allSatisfied) {
        await this.dataSource.manager.update(Transaction, transactionId, {
          status: TransactionStatus.WAITING_FOR_SIGNATURES,
        });
        await emitTransactionStatusUpdate(this.notificationsPublisher, [{ entityId: transactionId }]);
        return;
      }
    } else {
      await emitReviewerRejection(this.notificationsPublisher, [{ entityId: transactionId }]);
    }
  }

  private async findPendingMembers(
    transactionId: number,
    userId: number,
  ): Promise<TransactionReviewerListMember[]> {
    return this.dataSource.manager
      .createQueryBuilder(TransactionReviewerListMember, 'member')
      .innerJoin(
        TransactionReviewerList,
        'list',
        'list.id = member.listId AND list.transactionId = :transactionId',
        { transactionId },
      )
      .where('member.userId = :userId', { userId })
      .andWhere('member.actionedAt IS NULL')
      .getMany();
  }

  private async validateKeyAvailability(
    members: TransactionReviewerListMember[],
    userId: number,
  ): Promise<void> {
    for (const member of members) {
      if (!member.userKeyId) {
        throw new ForbiddenException(ErrorCodes.RKNA);
      }
      const key = await this.dataSource.manager.findOne(UserKey, {
        where: { id: member.userKeyId, userId },
      });
      if (!key) {
        throw new ForbiddenException(ErrorCodes.RKNA);
      }
    }
  }

  private async allListsSatisfied(transactionId: number): Promise<boolean> {
    const lists = await this.dataSource.manager.find(TransactionReviewerList, {
      where: { transactionId },
      relations: { members: true },
    });

    if (lists.length === 0) return false;

    return lists.every(list => {
      const acceptedCount = list.members.filter(m => m.accepted === true).length;
      return acceptedCount >= list.threshold;
    });
  }
}
