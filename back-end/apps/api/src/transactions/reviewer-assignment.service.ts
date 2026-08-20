import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, Equal, In, IsNull, Or } from 'typeorm';

import {
  ReviewerGroup,
  ReviewerRule,
  TransactionEntity,
  TransactionReviewerList,
  TransactionReviewerListMember,
  TransactionType,
} from '@entities';

@Injectable()
export class ReviewerAssignmentService {
  private readonly logger = new Logger(ReviewerAssignmentService.name);

  private ruleMatches(rule: ReviewerRule, entities: TransactionEntity[]): boolean {
    return entities.some(e =>
      e.hederaEntityId === rule.hederaEntityId &&
      (rule.entityRole === null || e.entityRole === rule.entityRole),
    );
  }

  // Matches rules against already-persisted transaction entities and snapshots reviewer groups.
  // Returns true if any reviewer lists were created (caller should set status to READY_FOR_REVIEW).
  // All DB operations use the provided EntityManager so they join the caller's transaction.
  async assign(
    transactionId: number,
    transactionType: TransactionType,
    network: string,
    em: EntityManager,
  ): Promise<boolean> {
    const entities = await em.find(TransactionEntity, { where: { transactionId } });

    const entityIds = entities.map(e => e.hederaEntityId);
    if (entityIds.length === 0) return false;

    const rules = await em.find(ReviewerRule, {
      where: {
        network,
        hederaEntityId: In(entityIds),
        transactionType: Or(IsNull(), Equal(transactionType)),
      },
    });

    const matchedGroupIds = [
      ...new Set(
        rules
          .filter(rule => this.ruleMatches(rule, entities))
          .map(rule => rule.groupId),
      ),
    ];

    if (matchedGroupIds.length === 0) return false;

    for (const groupId of matchedGroupIds) {
      await this.snapshotGroup(transactionId, groupId, em);
    }

    return true;
  }

  private async snapshotGroup(
    transactionId: number,
    groupId: number,
    em: EntityManager,
  ): Promise<void> {
    const group = await em.findOne(ReviewerGroup, {
      where: { id: groupId },
      relations: { members: true },
    });

    if (!group) {
      this.logger.warn(`Reviewer group ${groupId} not found during snapshot; skipping`);
      return;
    }

    const list = await em.save(
      TransactionReviewerList,
      em.create(TransactionReviewerList, {
        transactionId,
        name: group.name,
        description: group.description,
        threshold: group.threshold,
      }),
    );

    const memberRows = group.members.map(m =>
      em.create(TransactionReviewerListMember, {
        listId: list.id,
        userId: m.userId,
        userKeyId: m.userKeyId,
      }),
    );

    if (memberRows.length > 0) {
      await em.save(TransactionReviewerListMember, memberRows);
    }
  }
}
