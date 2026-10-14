import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, guardMock } from '@app/common';
import { ApiKeyRevokedReason, User, UserStatus } from '@entities';

import { VerifiedUserGuard } from '../guards';

import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService, ApiKeyReveal, ApiKeyStatus } from './api-keys.service';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let user: User;

  const apiKeysService = mockDeep<ApiKeysService>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [
        {
          provide: ApiKeysService,
          useValue: apiKeysService,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<ApiKeysController>(ApiKeysController);

    user = {
      id: 1,
      email: 'John@test.com',
      password: 'Doe',
      admin: true,
      canViewReports: false,
      status: UserStatus.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
      keys: [],
    } as unknown as User;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to the service and returns the revealed key", async () => {
      const reveal: ApiKeyReveal = { key: 'tt_abc_secret', keyId: 'abc', createdAt: new Date() };
      apiKeysService.create.mockResolvedValue(reveal);

      const result = await controller.create(user);

      expect(apiKeysService.create).toHaveBeenCalledWith(user);
      expect(result).toBe(reveal);
    });

    it('propagates a rejection from the service', async () => {
      apiKeysService.create.mockRejectedValue(new Error('already exists'));

      await expect(controller.create(user)).rejects.toThrow('already exists');
    });
  });

  describe('regenerate', () => {
    it('delegates to the service and returns the revealed key', async () => {
      const reveal: ApiKeyReveal = { key: 'tt_def_secret', keyId: 'def', createdAt: new Date() };
      apiKeysService.regenerate.mockResolvedValue(reveal);

      const result = await controller.regenerate(user);

      expect(apiKeysService.regenerate).toHaveBeenCalledWith(user);
      expect(result).toBe(reveal);
    });

    it('propagates a rejection from the service', async () => {
      apiKeysService.regenerate.mockRejectedValue(new Error('no key exists'));

      await expect(controller.regenerate(user)).rejects.toThrow('no key exists');
    });
  });

  describe('revoke', () => {
    it("revokes the current user's own key with reason USER, attributing it to themselves", async () => {
      apiKeysService.revoke.mockResolvedValue(undefined);

      await controller.revoke(user);

      expect(apiKeysService.revoke).toHaveBeenCalledWith(
        user.id,
        ApiKeyRevokedReason.USER,
        user.id,
      );
    });
  });

  describe('getStatus', () => {
    it("delegates to the service for the current user's status", async () => {
      const status: ApiKeyStatus = {
        hasKey: true,
        keyId: 'abc',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        revokedReason: null,
        idleExpiryDays: 180,
      };
      apiKeysService.getStatus.mockResolvedValue(status);

      const result = await controller.getStatus(user);

      expect(apiKeysService.getStatus).toHaveBeenCalledWith(user.id);
      expect(result).toBe(status);
    });
  });
});
