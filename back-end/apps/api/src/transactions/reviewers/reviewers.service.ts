import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { PublicKey } from '@hiero-ledger/sdk';

import {
  decode,
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

import { ReviewActionDto, ReviewSignatureDto } from '../dto';

// Builds the message a reviewer signs to attest to their decision. This is intentionally NOT
// the transaction's bodyBytes (a transaction may contain multiple inner transactions/chunks,
// so there is no single canonical byte payload to sign) and this signature is never added to
// the transaction itself. It instead binds the reviewer's key to the specific decision made on
// this transaction, keyed off the transaction's single canonical hash.
export const buildReviewAttestationMessage = (
  transactionId: number,
  accepted: boolean,
  note: string | undefined,
  transactionHash: string,
): Buffer =>
  Buffer.from(
    `${transactionId}:${accepted ? 'ACCEPT' : 'REJECT'}:${note ?? ''}:${transactionHash}`,
  );

@Injectable()
export class ReviewersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {}

  async submitReview(transactionId: number, dto: ReviewActionDto, user: User): Promise<void> {
    // The status check, member updates, threshold evaluation, and conditional status transition
    // all happen under a pessimistic write lock on the transaction row. That lock serializes
    // concurrent review submissions for the same transactionId, so a second request can't act on
    // a phase the first request is in the middle of closing out, and a failure partway through
    // rolls back the member updates along with the status transition.
    const emit = await this.dataSource.transaction(async em => {
      const transaction = await em.findOne(Transaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction) throw new NotFoundException(ErrorCodes.TNF);

      if (transaction.status !== TransactionStatus.READY_FOR_REVIEW) {
        throw new ConflictException(ErrorCodes.TRPC);
      }

      const pendingMembers = await this.findPendingMembers(em, transactionId, user.id);
      if (pendingMembers.length === 0) {
        throw new ForbiddenException(ErrorCodes.RNPF);
      }

      const message = buildReviewAttestationMessage(
        transactionId,
        dto.accepted,
        dto.note,
        transaction.transactionHash,
      );
      const signedGroups = await this.resolveSignedGroups(
        em,
        pendingMembers,
        user.id,
        message,
        dto.signatures,
      );

      for (const group of signedGroups) {
        await em
          .createQueryBuilder()
          .update(TransactionReviewerListMember)
          .set({
            accepted: dto.accepted,
            note: dto.note ?? null,
            signature: group.signatureBytes,
            actionedAt: new Date(),
          })
          .whereInIds(group.members.map(m => m.id))
          .execute();
      }

      if (dto.accepted) {
        const allSatisfied = await this.allListsSatisfied(em, transactionId);
        if (allSatisfied) {
          await em.update(Transaction, transactionId, {
            status: TransactionStatus.WAITING_FOR_SIGNATURES,
          });
          return 'status-update' as const;
        }
        return null;
      }

      return 'rejection' as const;
    });

    if (emit === 'status-update') {
      await emitTransactionStatusUpdate(this.notificationsPublisher, [{ entityId: transactionId }]);
    } else if (emit === 'rejection') {
      await emitReviewerRejection(this.notificationsPublisher, [{ entityId: transactionId }]);
    }
  }

  private async findPendingMembers(
    em: EntityManager,
    transactionId: number,
    userId: number,
  ): Promise<TransactionReviewerListMember[]> {
    return em
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

  // A user's pending memberships across different reviewer lists on the same transaction may
  // each be pre-assigned a different key (e.g. a "Finance" list and a "Compliance" list can hand
  // the same user distinct keys). The client tells us exactly which key each submitted signature
  // was produced with (rather than us guessing which of the user's keys a lone signature might
  // match), so a signature only ever actions the pending rows tied to its declared userKeyId.
  // A reviewer only needs to submit signatures for the keys they actually have available; rows
  // referencing a userKeyId not covered by any submitted signature are left untouched and still
  // pending. That is not an error and the reviewer can act on them later, e.g. from another
  // device that has the other key. Every pair the reviewer does submit is verified up front, so
  // an invalid/unknown key or a bad signature aborts the whole request before any row is touched.
  private async resolveSignedGroups(
    em: EntityManager,
    pendingMembers: TransactionReviewerListMember[],
    userId: number,
    message: Buffer,
    signatures: ReviewSignatureDto[],
  ): Promise<{ members: TransactionReviewerListMember[]; signatureBytes: Buffer }[]> {
    const pendingKeyIds = new Set(
      pendingMembers.map(m => m.userKeyId).filter((id): id is number => id != null),
    );
    if (pendingKeyIds.size === 0) {
      throw new ForbiddenException(ErrorCodes.RKNA);
    }

    const submittedKeyIds = [...new Set(signatures.map(s => s.userKeyId))];
    const keys = await em.find(UserKey, {
      where: { id: In(submittedKeyIds), userId },
    });
    const keysById = new Map(keys.map(k => [k.id, k]));

    const groups: { members: TransactionReviewerListMember[]; signatureBytes: Buffer }[] = [];
    for (const { userKeyId, signature } of signatures) {
      const key = keysById.get(userKeyId);
      if (!key) {
        throw new ForbiddenException(ErrorCodes.RKNA);
      }

      let signatureBytes: Buffer;
      try {
        signatureBytes = decode(signature);
      } catch {
        throw new ForbiddenException(ErrorCodes.RSIV);
      }

      let valid: boolean;
      try {
        valid = PublicKey.fromString(key.publicKey).verify(message, signatureBytes);
      } catch {
        valid = false;
      }
      if (!valid) {
        throw new ForbiddenException(ErrorCodes.RSIV);
      }

      const members = pendingMembers.filter(m => m.userKeyId === userKeyId);
      if (members.length > 0) {
        groups.push({ members, signatureBytes });
      }
    }

    if (groups.length === 0) {
      throw new ForbiddenException(ErrorCodes.RKNA);
    }

    return groups;
  }

  private async allListsSatisfied(em: EntityManager, transactionId: number): Promise<boolean> {
    const lists = await em.find(TransactionReviewerList, {
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
