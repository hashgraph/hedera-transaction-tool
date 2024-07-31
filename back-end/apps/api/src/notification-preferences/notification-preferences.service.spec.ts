import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';

import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferences, User } from '@entities';
import { UpdateNotificationPreferencesDto } from './dtos';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  const repo = mockDeep<Repository<NotificationPreferences>>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updatePreferences', () => {
    let user: User;

    beforeEach(() => {
      user = { id: 1 } as User;
    });

    it('should update existing preferences', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        transactionRequiredSignature: true,
        transactionReadyForExecution: false,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        transactionRequiredSignature: false,
        transactionReadyForExecution: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.update).toHaveBeenCalledWith(
        { id: existingPreferences.id },
        {
          transactionRequiredSignature: dto.transactionRequiredSignature,
          transactionReadyForExecution: dto.transactionReadyForExecution,
        },
      );
      expect(result).toEqual({
        ...existingPreferences,
        transactionRequiredSignature: dto.transactionRequiredSignature,
        transactionReadyForExecution: dto.transactionReadyForExecution,
      });
    });

    it('should update preferences correctly if only one field is provided', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        transactionRequiredSignature: true,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        transactionRequiredSignature: false,
        transactionReadyForExecution: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.update).toHaveBeenCalledWith(
        { id: existingPreferences.id },
        {
          transactionRequiredSignature: dto.transactionRequiredSignature,
        },
      );
      expect(result).toEqual({
        ...existingPreferences,
        transactionRequiredSignature: dto.transactionRequiredSignature,
      });
    });

    it('should update preferences correctly if only one field is provided', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        transactionReadyForExecution: false,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        transactionRequiredSignature: false,
        transactionReadyForExecution: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.update).toHaveBeenCalledWith(
        { id: existingPreferences.id },
        {
          transactionReadyForExecution: dto.transactionReadyForExecution,
        },
      );
      expect(result).toEqual({
        ...existingPreferences,
        transactionReadyForExecution: dto.transactionReadyForExecution,
      });
    });

    it('should create new preferences if none exist', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        transactionRequiredSignature: true,
        transactionReadyForExecution: false,
      };

      repo.findOne.mockResolvedValue(null);
      const newPreferences = { userId: user.id, ...dto } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        transactionRequiredSignature: dto.transactionRequiredSignature,
        transactionReadyForExecution: dto.transactionReadyForExecution,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });

    it('should create new preferences if none exists with only one field', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        transactionRequiredSignature: true,
      };

      repo.findOne.mockResolvedValue(null);
      const newPreferences = { userId: user.id, ...dto } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        transactionRequiredSignature: dto.transactionRequiredSignature,
        transactionReadyForExecution: true,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });

    it('should create new preferences if none exists with only one field', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        transactionReadyForExecution: true,
      };

      repo.findOne.mockResolvedValue(null);
      const newPreferences = { userId: user.id, ...dto } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        transactionReadyForExecution: dto.transactionReadyForExecution,
        transactionRequiredSignature: true,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });
  });

  describe('getPreferencesOrCreate', () => {
    it('should return existing preferences if found', async () => {
      const user = { id: 1 } as User;
      const existingPreferences = { userId: user.id } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.getPreferencesOrCreate(user);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(result).toEqual(existingPreferences);
    });

    it('should create new preferences if none exist', async () => {
      const user = { id: 1 } as User;
      repo.findOne.mockResolvedValue(null);
      const newPreferences = {
        userId: user.id,
        transactionRequiredSignature: true,
        transactionReadyForExecution: true,
      } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.getPreferencesOrCreate(user);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        transactionRequiredSignature: true,
        transactionReadyForExecution: true,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const user = { id: 1 } as User;
      const preferences = { userId: user.id } as NotificationPreferences;
      repo.findOne.mockResolvedValue(preferences);

      const result = await service.getPreferences(user);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(result).toEqual(preferences);
    });

    it('should return null if no preferences found', async () => {
      const user = { id: 1 } as User;
      repo.findOne.mockResolvedValue(null);

      const result = await service.getPreferences(user);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(result).toBeNull();
    });
  });
});
