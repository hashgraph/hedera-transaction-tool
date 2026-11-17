import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';

import {
  ChangeRequestStatus,
  GroupChangeRecord,
  GroupChangeType,
  GroupSnapshot,
  ReviewerGroup,
  ReviewerGroupMember,
  UserKey,
} from '@entities';

import { ErrorCodes } from '@app/common';

import {
  CreateReviewerGroupDto,
  DeleteReviewerGroupDto,
  GroupMemberInputDto,
  UpdateReviewerGroupDto,
} from './dtos';

@Injectable()
export class ReviewerGroupsService {
  constructor(
    @InjectRepository(ReviewerGroup) private groupRepo: Repository<ReviewerGroup>,
    @InjectRepository(GroupChangeRecord) private groupChangeRecordRepo: Repository<GroupChangeRecord>,
    @InjectRepository(UserKey) private userKeyRepo: Repository<UserKey>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getGroups(): Promise<ReviewerGroup[]> {
    return this.groupRepo.find();
  }

  async getGroupChanges(id: number): Promise<GroupChangeRecord[]> {
    const group = await this.groupRepo.findOne({ where: { id }, withDeleted: true });
    if (!group) throw new NotFoundException(ErrorCodes.RGNF);
    return this.groupChangeRecordRepo.find({
      where: { groupId: id },
      order: { snapshotVersion: 'ASC' },
    });
  }

  async getGroup(id: number): Promise<ReviewerGroup> {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: { members: true, rules: true },
    });
    if (!group) throw new NotFoundException(ErrorCodes.RGNF);

    // required: false — a member whose underlying user was removed from the org has no
    // resolvable key; drop them rather than fail the whole request. Their past reviews are
    // already "unverifiable" the same way any departed member's are.
    const keyMap = await this.loadUserKeys(group.members.map(m => m.userKeyId), { required: false });
    group.members = group.members
      .filter(m => keyMap.has(m.userKeyId))
      .map(m => Object.assign(m, { publicKey: keyMap.get(m.userKeyId)! }));

    return group;
  }

  async createGroup(dto: CreateReviewerGroupDto, userId: number): Promise<ReviewerGroup> {
    if (dto.threshold > dto.members.length) {
      throw new BadRequestException(ErrorCodes.RGMT);
    }
    this.assertUniqueMembers(dto.members);

    const keyMap = await this.loadUserKeys(dto.members.map(m => m.userKeyId));

    return this.dataSource.transaction(async manager => {
      const group = manager.create(ReviewerGroup, {
        name: dto.name,
        description: dto.description ?? null,
        threshold: dto.threshold,
      });
      await manager.save(group);

      const savedMembers: ReviewerGroupMember[] = [];
      for (const m of dto.members) {
        const member = manager.create(ReviewerGroupMember, {
          groupId: group.id,
          userId: m.userId,
          userKeyId: m.userKeyId,
        });
        await manager.save(member);
        savedMembers.push(Object.assign(member, { publicKey: keyMap.get(m.userKeyId)! }));
      }

      const snapshotPayload = this.buildSnapshot(
        group.name,
        group.description,
        group.threshold,
        dto.members,
        keyMap,
      );

      // snapshotVersion=1 is the initial state; no prior members exist to attest it.
      const changeRecord = manager.create(GroupChangeRecord, {
        groupId: group.id,
        userId,
        userKeyId: dto.userKeyId,
        userSignature: dto.userSignature,
        type: GroupChangeType.UPDATE,
        status: ChangeRequestStatus.APPLIED,
        snapshotVersion: 1,
        snapshotPayload,
        attestationSignatures: [],
      });
      await manager.save(changeRecord);

      group.members = savedMembers;
      group.rules = [];
      return group;
    });
  }

  async updateGroup(id: number, dto: UpdateReviewerGroupDto, userId: number): Promise<GroupChangeRecord> {
    await this.assertNoPendingRequest(id);

    const latest = await this.getLatestAppliedRecord(id);
    if (!latest || latest.type === GroupChangeType.DELETE) throw new NotFoundException(ErrorCodes.RGNF);

    const current = latest.snapshotPayload;
    const proposedName = dto.name ?? current.name;
    const proposedDescription = dto.description !== undefined ? dto.description : current.description;
    const proposedThreshold = dto.threshold ?? current.threshold;
    const proposedMembers: GroupMemberInputDto[] =
      dto.members ?? current.members.map(m => ({ userId: m.userId, userKeyId: m.userKeyId }));

    if (proposedThreshold > proposedMembers.length) {
      throw new BadRequestException(ErrorCodes.RGMT);
    }
    this.assertUniqueMembers(proposedMembers);

    const keyMap = await this.loadUserKeys(proposedMembers.map(m => m.userKeyId));
    const snapshotPayload = this.buildSnapshot(
      proposedName,
      proposedDescription,
      proposedThreshold,
      proposedMembers,
      keyMap,
    );

    try {
      return await this.dataSource.transaction(async manager => {
        const record = manager.create(GroupChangeRecord, {
          groupId: id,
          userId,
          userKeyId: dto.userKeyId,
          userSignature: dto.userSignature,
          type: GroupChangeType.UPDATE,
          status: ChangeRequestStatus.PENDING,
          snapshotVersion: latest.snapshotVersion + 1,
          snapshotPayload,
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

  async deleteGroup(id: number, dto: DeleteReviewerGroupDto, userId: number): Promise<GroupChangeRecord> {
    await this.assertNoPendingRequest(id);

    const latest = await this.getLatestAppliedRecord(id);
    if (!latest || latest.type === GroupChangeType.DELETE) throw new NotFoundException(ErrorCodes.RGNF);

    try {
      return await this.dataSource.transaction(async manager => {
        const record = manager.create(GroupChangeRecord, {
          groupId: id,
          userId,
          userKeyId: dto.userKeyId,
          userSignature: dto.userSignature,
          type: GroupChangeType.DELETE,
          status: ChangeRequestStatus.PENDING,
          snapshotVersion: latest.snapshotVersion + 1,
          snapshotPayload: latest.snapshotPayload,
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

  private assertUniqueMembers(members: GroupMemberInputDto[]): void {
    const userIds = members.map(m => m.userId);
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException(ErrorCodes.RGDM);
    }
  }

  private async assertNoPendingRequest(groupId: number): Promise<void> {
    const existing = await this.groupChangeRecordRepo.findOne({
      where: { groupId, status: ChangeRequestStatus.PENDING },
    });
    if (existing) throw new ConflictException(ErrorCodes.RGCP);
  }

  private async getLatestAppliedRecord(groupId: number): Promise<GroupChangeRecord | null> {
    return this.groupChangeRecordRepo.findOne({
      where: { groupId, status: ChangeRequestStatus.APPLIED },
      order: { snapshotVersion: 'DESC' },
    });
  }

  private buildSnapshot(
    name: string,
    description: string | null,
    threshold: number,
    members: GroupMemberInputDto[],
    keyMap: Map<number, string>,
  ): GroupSnapshot {
    return {
      name,
      description,
      threshold,
      members: members.map(m => ({
        userId: m.userId,
        userKeyId: m.userKeyId,
        publicKey: keyMap.get(m.userKeyId)!,
      })),
    };
  }

  private async loadUserKeys(
    userKeyIds: number[],
    opts: { required?: boolean } = {},
  ): Promise<Map<number, string>> {
    if (!userKeyIds.length) return new Map();
    const keys = await this.userKeyRepo.findBy({ id: In(userKeyIds) });
    const keyMap = new Map(keys.map(k => [k.id, k.publicKey]));
    if (opts.required !== false) {
      const missing = userKeyIds.find(id => !keyMap.has(id));
      if (missing !== undefined) throw new BadRequestException(ErrorCodes.KNF);
    }
    return keyMap;
  }

}
