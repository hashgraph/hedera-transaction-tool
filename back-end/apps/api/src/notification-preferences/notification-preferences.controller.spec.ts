import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { guardMock } from '@app/common';
import { NotificationPreferences, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../guards';
import { UpdateNotificationPreferencesDto } from './dtos';

import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let service: NotificationPreferencesService;
  const repo = mockDeep<Repository<NotificationPreferences>>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        NotificationPreferencesService,
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: repo,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardMock())
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<NotificationPreferencesController>(NotificationPreferencesController);
    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updatePreferences', () => {
    it('should update the notification preferences for the current user', async () => {
      const user = { id: 1 } as User;
      const dto: UpdateNotificationPreferencesDto = {
        transactionRequiredSignature: true,
        transactionReadyForExecution: false,
      };
      const updatedPreferences = { userId: user.id, ...dto } as NotificationPreferences;

      jest.spyOn(service, 'updatePreferences').mockResolvedValue(updatedPreferences);

      const result = await controller.updatePreferences(user, dto);

      expect(service.updatePreferences).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(updatedPreferences);
    });
  });

  describe('getPreferencesOrCreate', () => {
    it("should get the user's notification preferences", async () => {
      const user = { id: 1 } as User;
      const preferences = { userId: user.id } as NotificationPreferences;

      jest.spyOn(service, 'getPreferencesOrCreate').mockResolvedValue(preferences);

      const result = await controller.getPreferencesOrCreate(user);

      expect(service.getPreferencesOrCreate).toHaveBeenCalledWith(user);
      expect(result).toEqual(preferences);
    });

    it('should return null if no preferences found', async () => {
      const user = { id: 1 } as User;

      jest.spyOn(service, 'getPreferencesOrCreate').mockResolvedValue(null);

      const result = await controller.getPreferencesOrCreate(user);

      expect(service.getPreferencesOrCreate).toHaveBeenCalledWith(user);
      expect(result).toBeNull();
    });
  });
});