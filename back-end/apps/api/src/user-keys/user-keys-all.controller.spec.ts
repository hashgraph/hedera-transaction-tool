import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, guardMock } from '@app/common';

import { VerifiedUserGuard } from '../guards';

import { UserKeysAllController } from './user-keys-all.controller';
import { UserKeysService } from './user-keys.service';

describe('UserKeysAllController', () => {
  let controller: UserKeysAllController;

  const userKeysService = mockDeep<UserKeysService>();
  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKeysAllController],
      providers: [
        {
          provide: UserKeysService,
          useValue: userKeysService,
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

    controller = module.get<UserKeysAllController>(UserKeysAllController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getKeys', () => {
    it('should call service with args', async () => {
      await controller.getUserKeys({ page: 1, size: 20, limit: 20, offset: 0 });

      expect(userKeysService.getUserKeys).toHaveBeenCalledWith({
        page: 1,
        size: 20,
        limit: 20,
        offset: 0,
      });
    });
  });
});
