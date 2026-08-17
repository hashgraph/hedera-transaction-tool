import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';

import {
  ChangeRequestStatus,
  GroupChangeRecord,
  GroupChangeType,
  ReviewerGroup,
  ReviewerRule,
  RuleChangeRecord,
  ReviewerAction,
  RulePayload,
} from '@entities';

import { ErrorCodes } from '@app/common';

import { CreateReviewerRuleDto, DeleteReviewerRuleDto } from './dtos';

@Injectable()
export class ReviewerRulesService {
  constructor(
    @InjectRepository(ReviewerGroup) private groupRepo: Repository<ReviewerGroup>,
    @InjectRepository(ReviewerRule) private ruleRepo: Repository<ReviewerRule>,
    @InjectRepository(RuleChangeRecord) private ruleChangeRecordRepo: Repository<RuleChangeRecord>,
    @InjectRepository(GroupChangeRecord) private groupChangeRecordRepo: Repository<GroupChangeRecord>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getRules(): Promise<ReviewerRule[]> {
    return this.ruleRepo.find();
  }

  async getRuleChanges(id: number): Promise<RuleChangeRecord[]> {
    const rule = await this.ruleRepo.findOne({ where: { id }, withDeleted: true });
    if (!rule) throw new NotFoundException(ErrorCodes.RRNF);
    return this.ruleChangeRecordRepo.find({
      where: { ruleId: id },
      order: { id: 'ASC' },
    });
  }

  async getRule(id: number): Promise<ReviewerRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(ErrorCodes.RRNF);
    return rule;
  }

  async createRule(dto: CreateReviewerRuleDto, userId: number): Promise<ReviewerRule> {
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException(ErrorCodes.RGNF);

    const rulePayload: RulePayload = {
      hederaEntityId: dto.hederaEntityId,
      network: dto.network,
      entityRole: dto.entityRole ?? null,
      transactionType: dto.transactionType ?? null,
    };

    try {
      return await this.dataSource.transaction(async manager => {
        // Restore a previously soft-deleted rule rather than inserting a fresh row.
        // This keeps the ruleId stable across the rule's lifecycle so that all
        // RuleChangeRecord FKs point to the same row regardless of how many times
        // the rule has been removed and re-added.
        const softDeleted = await this.findSoftDeletedRule(manager, dto);

        let rule: ReviewerRule;
        if (softDeleted) {
          await manager.restore(ReviewerRule, { id: softDeleted.id });
          softDeleted.deletedAt = null;
          rule = softDeleted;
        } else {
          rule = manager.create(ReviewerRule, {
            groupId: dto.groupId,
            hederaEntityId: dto.hederaEntityId,
            network: dto.network,
            entityRole: dto.entityRole ?? null,
            transactionType: dto.transactionType ?? null,
          });
          await manager.save(rule);
        }

        const changeRecord = manager.create(RuleChangeRecord, {
          ruleId: rule.id,
          groupId: dto.groupId,
          userId,
          userKeyId: dto.userKeyId,
          userSignature: dto.userSignature ?? null,
          action: ReviewerAction.ADD,
          status: ChangeRequestStatus.APPLIED,
          rulePayload,
          groupSnapshotVersion: null,
          attestationSignatures: null,
        });
        await manager.save(changeRecord);

        return rule;
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new BadRequestException(ErrorCodes.RGDR);
      }
      throw err;
    }
  }

  async deleteRule(id: number, dto: DeleteReviewerRuleDto, userId: number): Promise<RuleChangeRecord> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(ErrorCodes.RRNF);

    const existingPending = await this.ruleChangeRecordRepo.findOne({
      where: { ruleId: id, status: ChangeRequestStatus.PENDING },
    });
    if (existingPending) throw new ConflictException(ErrorCodes.RGCP);

    const latestGroupRecord = await this.groupChangeRecordRepo.findOne({
      where: { groupId: rule.groupId, status: ChangeRequestStatus.APPLIED },
      order: { snapshotVersion: 'DESC' },
    });
    if (!latestGroupRecord || latestGroupRecord.type === GroupChangeType.DELETE) {
      throw new NotFoundException(ErrorCodes.RGNF);
    }

    const currentVersion = latestGroupRecord.snapshotVersion;

    const rulePayload: RulePayload = {
      hederaEntityId: rule.hederaEntityId,
      network: rule.network,
      entityRole: rule.entityRole,
      transactionType: rule.transactionType,
    };

    try {
      return await this.dataSource.transaction(async manager => {
        const record = manager.create(RuleChangeRecord, {
          ruleId: id,
          groupId: rule.groupId,
          userId,
          userKeyId: dto.userKeyId,
          userSignature: dto.userSignature ?? null,
          action: ReviewerAction.REMOVE,
          status: ChangeRequestStatus.PENDING,
          rulePayload,
          groupSnapshotVersion: currentVersion,
          attestationSignatures: [],
        });
        await manager.save(record);
        return record;
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException(ErrorCodes.RGCP);
      }
      throw err;
    }
  }

  private async findSoftDeletedRule(
    manager: EntityManager,
    dto: CreateReviewerRuleDto,
  ): Promise<ReviewerRule | null> {
    const entityRole = dto.entityRole ?? null;
    const transactionType = dto.transactionType ?? null;

    const qb = manager
      .createQueryBuilder(ReviewerRule, 'rule')
      .withDeleted()
      .where('rule.groupId = :groupId', { groupId: dto.groupId })
      .andWhere('rule.hederaEntityId = :hederaEntityId', { hederaEntityId: dto.hederaEntityId })
      .andWhere('rule.network = :network', { network: dto.network })
      .andWhere('rule.deletedAt IS NOT NULL');

    if (entityRole !== null) {
      qb.andWhere('rule.entityRole = :entityRole', { entityRole });
    } else {
      qb.andWhere('rule.entityRole IS NULL');
    }

    if (transactionType !== null) {
      qb.andWhere('rule.transactionType = :transactionType', { transactionType });
    } else {
      qb.andWhere('rule.transactionType IS NULL');
    }

    return qb.getOne();
  }
}
