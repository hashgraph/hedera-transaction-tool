import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

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

import { CreateReviewerGroupDto, DeleteReviewerGroupDto, UpdateReviewerGroupDto } from './dtos';
import { ReviewerGroupsService } from './reviewer-groups.service';

describe('ReviewerGroupsService', () => {
  let service: ReviewerGroupsService;

  const groupRepo = mockDeep<Repository<ReviewerGroup>>();
  const groupChangeRecordRepo = mockDeep<Repository<GroupChangeRecord>>();
  const userKeyRepo = mockDeep<Repository<UserKey>>();
  const dataSource = mockDeep<DataSource>();
  const manager = mockDeep<EntityManager>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewerGroupsService,
        { provide: getRepositoryToken(ReviewerGroup), useValue: groupRepo },
        { provide: getRepositoryToken(GroupChangeRecord), useValue: groupChangeRecordRepo },
        { provide: getRepositoryToken(UserKey), useValue: userKeyRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(ReviewerGroupsService);
    jest.resetAllMocks();
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));
  });

  const mockGroup = (): ReviewerGroup =>
    ({ id: 1, name: 'Test Group', description: null, threshold: 1, members: [], rules: [] } as unknown as ReviewerGroup);

  const mockSnapshot = (): GroupSnapshot => ({
    name: 'Test Group',
    description: null,
    threshold: 1,
    members: [{ userId: 10, userKeyId: 20, publicKey: 'pubkey' }],
  });

  const mockAppliedRecord = (overrides: Partial<GroupChangeRecord> = {}): GroupChangeRecord =>
    ({
      id: 1,
      groupId: 1,
      type: GroupChangeType.UPDATE,
      status: ChangeRequestStatus.APPLIED,
      snapshotVersion: 1,
      snapshotPayload: mockSnapshot(),
      attestationSignatures: [],
      ...overrides,
    } as unknown as GroupChangeRecord);

  describe('getGroups', () => {
    it('returns all groups', async () => {
      const groups = [mockGroup()];
      groupRepo.find.mockResolvedValueOnce(groups);

      const result = await service.getGroups();

      expect(result).toBe(groups);
    });
  });

  describe('getGroupChanges', () => {
    it('throws RGNF if group not found', async () => {
      groupRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getGroupChanges(1)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('returns all change records when no fromVersion supplied', async () => {
      const records = [mockAppliedRecord()];
      groupRepo.findOne.mockResolvedValueOnce(mockGroup());
      groupChangeRecordRepo.find.mockResolvedValueOnce(records);

      const result = await service.getGroupChanges(1);

      expect(result).toBe(records);
      expect(groupChangeRecordRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { groupId: 1 } }),
      );
    });

    it('filters by fromVersion when supplied', async () => {
      groupRepo.findOne.mockResolvedValueOnce(mockGroup());
      groupChangeRecordRepo.find.mockResolvedValueOnce([]);

      await service.getGroupChanges(1, 3);

      expect(groupChangeRecordRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: 1, snapshotVersion: expect.anything() }),
        }),
      );
    });
  });

  describe('getGroup', () => {
    it('throws RGNF if group not found', async () => {
      groupRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getGroup(1)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('returns group with members and rules', async () => {
      const group = mockGroup();
      groupRepo.findOne.mockResolvedValueOnce(group);

      const result = await service.getGroup(1);

      expect(result).toBe(group);
      expect(groupRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['members', 'rules'] }),
      );
    });
  });

  describe('createGroup', () => {
    const dto: CreateReviewerGroupDto = {
      name: 'Test Group',
      description: null,
      threshold: 1,
      members: [{ userId: 10, userKeyId: 20 }],
      userKeyId: 99,
      userSignature: null,
    };

    it('throws RGMT if threshold exceeds member count', async () => {
      const badDto = { ...dto, threshold: 2 };

      await expect(service.createGroup(badDto, 5)).rejects.toThrow(ErrorCodes.RGMT);
    });

    it('throws RGDM if the same userId appears twice in members', async () => {
      const badDto = { ...dto, members: [{ userId: 10, userKeyId: 20 }, { userId: 10, userKeyId: 21 }], threshold: 1 };

      await expect(service.createGroup(badDto, 5)).rejects.toThrow(ErrorCodes.RGDM);
    });

    it('throws KNF if a member userKeyId does not exist', async () => {
      userKeyRepo.findBy.mockResolvedValueOnce([]);

      await expect(service.createGroup(dto, 5)).rejects.toThrow(ErrorCodes.KNF);
    });

    it('creates group, members, and trust anchor change record in a transaction', async () => {
      const group = mockGroup();
      const member = { id: 1, groupId: 1, userId: 10, userKeyId: 20 } as ReviewerGroupMember;
      const changeRecord = mockAppliedRecord();

      userKeyRepo.findBy.mockResolvedValueOnce([{ id: 20, publicKey: 'pubkey' } as UserKey]);
      manager.create
        .mockReturnValueOnce(group as any)
        .mockReturnValueOnce(member as any)
        .mockReturnValueOnce(changeRecord as any);
      manager.save
        .mockResolvedValueOnce(group as any)
        .mockResolvedValueOnce(member as any)
        .mockResolvedValueOnce(changeRecord as any);

      const result = await service.createGroup(dto, 5);

      expect(result).toBe(group);
      expect(manager.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateGroup', () => {
    const dto: UpdateReviewerGroupDto = {
      name: 'Updated Group',
      userKeyId: 99,
      userSignature: null,
    };

    it('throws RGCP if a pending request already exists', async () => {
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(mockAppliedRecord({ status: ChangeRequestStatus.PENDING }));

      await expect(service.updateGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGCP);
    });

    it('throws RGNF if no latest applied record found', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null) // assertNoPendingRequest
        .mockResolvedValueOnce(null); // getLatestAppliedRecord

      await expect(service.updateGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('throws RGNF if latest applied record is a DELETE (group soft-deleted)', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord({ type: GroupChangeType.DELETE }));

      await expect(service.updateGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('throws RGMT if proposed threshold exceeds proposed member count', async () => {
      const snapshot = { ...mockSnapshot(), members: [] };
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord({ snapshotPayload: snapshot }));

      await expect(service.updateGroup(1, { ...dto, threshold: 1 }, 5)).rejects.toThrow(ErrorCodes.RGMT);
    });

    it('throws RGDM if the proposed member list contains duplicate userIds', async () => {
      const snapshot = { ...mockSnapshot(), members: [] };
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord({ snapshotPayload: snapshot }));

      const dupeDto = { ...dto, members: [{ userId: 10, userKeyId: 20 }, { userId: 10, userKeyId: 21 }], threshold: 1 };

      await expect(service.updateGroup(1, dupeDto, 5)).rejects.toThrow(ErrorCodes.RGDM);
    });

    it('throws KNF if a proposed userKeyId does not exist', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord());
      userKeyRepo.findBy.mockResolvedValueOnce([]);

      await expect(service.updateGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.KNF);
    });

    it('creates a PENDING UPDATE record and returns it', async () => {
      const pendingRecord = mockAppliedRecord({ type: GroupChangeType.UPDATE, status: ChangeRequestStatus.PENDING });
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord());
      userKeyRepo.findBy.mockResolvedValueOnce([{ id: 20, publicKey: 'pubkey' } as UserKey]);
      manager.create.mockReturnValueOnce(pendingRecord as any);
      manager.save.mockResolvedValueOnce(pendingRecord as any);

      const result = await service.updateGroup(1, dto, 5);

      expect(result).toBe(pendingRecord);
      expect(manager.create).toHaveBeenCalledWith(
        GroupChangeRecord,
        expect.objectContaining({
          type: GroupChangeType.UPDATE,
          status: ChangeRequestStatus.PENDING,
          snapshotVersion: 2,
        }),
      );
    });

    it('throws RGCP on concurrent duplicate insert (23505)', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord());
      userKeyRepo.findBy.mockResolvedValueOnce([{ id: 20, publicKey: 'pubkey' } as UserKey]);
      manager.create.mockReturnValueOnce({} as any);

      const dbError = new QueryFailedError('', [], new Error());
      (dbError as any).code = '23505';
      manager.save.mockRejectedValueOnce(dbError);

      await expect(service.updateGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGCP);
    });
  });

  describe('deleteGroup', () => {
    const dto: DeleteReviewerGroupDto = { userKeyId: 99, userSignature: null };

    it('throws RGCP if a pending request already exists', async () => {
      groupChangeRecordRepo.findOne.mockResolvedValueOnce(mockAppliedRecord({ status: ChangeRequestStatus.PENDING }));

      await expect(service.deleteGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGCP);
    });

    it('throws RGNF if no latest applied record found', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.deleteGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('throws RGNF if latest applied record is a DELETE (group already deleted)', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord({ type: GroupChangeType.DELETE }));

      await expect(service.deleteGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGNF);
    });

    it('creates a PENDING DELETE record copying the current snapshot', async () => {
      const latest = mockAppliedRecord();
      const pendingRecord = mockAppliedRecord({ type: GroupChangeType.DELETE, status: ChangeRequestStatus.PENDING });
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(latest);
      manager.create.mockReturnValueOnce(pendingRecord as any);
      manager.save.mockResolvedValueOnce(pendingRecord as any);

      const result = await service.deleteGroup(1, dto, 5);

      expect(result).toBe(pendingRecord);
      expect(manager.create).toHaveBeenCalledWith(
        GroupChangeRecord,
        expect.objectContaining({
          type: GroupChangeType.DELETE,
          status: ChangeRequestStatus.PENDING,
          snapshotVersion: 2,
          snapshotPayload: latest.snapshotPayload,
        }),
      );
    });

    it('throws RGCP on concurrent duplicate insert (23505)', async () => {
      groupChangeRecordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAppliedRecord());
      manager.create.mockReturnValueOnce({} as any);

      const dbError = new QueryFailedError('', [], new Error());
      (dbError as any).code = '23505';
      manager.save.mockRejectedValueOnce(dbError);

      await expect(service.deleteGroup(1, dto, 5)).rejects.toThrow(ErrorCodes.RGCP);
    });
  });
});
