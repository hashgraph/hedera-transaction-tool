import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';
import { User, UserStatus } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard, AdminGuard } from '../guards';

import {
  CreateReviewerGroupDto,
  DeleteReviewerGroupDto,
  UpdateReviewerGroupDto,
} from './dtos';
import { ReviewerGroupsController } from './reviewer-groups.controller';
import { ReviewerGroupsService } from './reviewer-groups.service';

describe('ReviewerGroupsController', () => {
  let controller: ReviewerGroupsController;

  const service = mockDeep<ReviewerGroupsService>();

  const user: User = {
    id: 1,
    email: 'admin@test.com',
    password: 'hash',
    admin: true,
    status: UserStatus.NONE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    keys: [],
    signerForTransactions: [],
    observableTransactions: [],
    approvableTransactions: [],
    comments: [],
    issuedNotifications: [],
    receivedNotifications: [],
    notificationPreferences: [],
    clients: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewerGroupsController],
      providers: [{ provide: ReviewerGroupsService, useValue: service }],
    })
      .overrideGuard(JwtBlackListAuthGuard).useValue(guardMock())
      .overrideGuard(JwtAuthGuard).useValue(guardMock())
      .overrideGuard(VerifiedUserGuard).useValue(guardMock())
      .overrideGuard(AdminGuard).useValue(guardMock())
      .compile();

    controller = module.get(ReviewerGroupsController);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGroups', () => {
    it('delegates to service.getGroups and returns result', async () => {
      const result = [] as any;
      service.getGroups.mockResolvedValueOnce(result);

      expect(await controller.getGroups()).toBe(result);
      expect(service.getGroups).toHaveBeenCalled();
    });
  });

  describe('getGroupChanges', () => {
    it('delegates to service.getGroupChanges with id and optional fromVersion', async () => {
      const result = [] as any;
      service.getGroupChanges.mockResolvedValueOnce(result);

      expect(await controller.getGroupChanges(1, 3)).toBe(result);
      expect(service.getGroupChanges).toHaveBeenCalledWith(1, 3);
    });

    it('passes undefined fromVersion when not supplied', async () => {
      service.getGroupChanges.mockResolvedValueOnce([]);

      await controller.getGroupChanges(1, undefined);

      expect(service.getGroupChanges).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('getGroup', () => {
    it('delegates to service.getGroup and returns result', async () => {
      const result = {} as any;
      service.getGroup.mockResolvedValueOnce(result);

      expect(await controller.getGroup(1)).toBe(result);
      expect(service.getGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('createGroup', () => {
    it('delegates to service.createGroup with dto and user id', async () => {
      const dto = {} as CreateReviewerGroupDto;
      const result = {} as any;
      service.createGroup.mockResolvedValueOnce(result);

      expect(await controller.createGroup(dto, user)).toBe(result);
      expect(service.createGroup).toHaveBeenCalledWith(dto, user.id);
    });
  });

  describe('updateGroup', () => {
    it('delegates to service.updateGroup with id, dto, and user id', async () => {
      const dto = {} as UpdateReviewerGroupDto;
      const result = {} as any;
      service.updateGroup.mockResolvedValueOnce(result);

      expect(await controller.updateGroup(1, dto, user)).toBe(result);
      expect(service.updateGroup).toHaveBeenCalledWith(1, dto, user.id);
    });
  });

  describe('deleteGroup', () => {
    it('delegates to service.deleteGroup with id, dto, and user id', async () => {
      const dto = {} as DeleteReviewerGroupDto;
      const result = {} as any;
      service.deleteGroup.mockResolvedValueOnce(result);

      expect(await controller.deleteGroup(1, dto, user)).toBe(result);
      expect(service.deleteGroup).toHaveBeenCalledWith(1, dto, user.id);
    });
  });
});
