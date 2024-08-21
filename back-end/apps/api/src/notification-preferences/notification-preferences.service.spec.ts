import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';

import { NotificationPreferences, NotificationType, User } from '@entities';

import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dtos';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  const repo = mockDeep<Repository<NotificationPreferences>>();

  beforeEach(async () => {
    jest.resetAllMocks();

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
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: false,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: false,
        inApp: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.update).toHaveBeenCalledWith(
        { id: existingPreferences.id },
        {
          email: dto.email,
          inApp: dto.inApp,
        },
      );
      expect(result).toEqual({
        ...existingPreferences,
        email: dto.email,
        inApp: dto.inApp,
      });
    });

    it('should update preferences correctly if only one field is provided', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: false,
        inApp: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.update).toHaveBeenCalledWith(
        { id: existingPreferences.id },
        {
          email: dto.email,
        },
      );
      expect(result).toEqual({
        ...existingPreferences,
        email: dto.email,
      });
    });

    it('should update preferences correctly if only one field is provided', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        type: NotificationType.TRANSACTION_CREATED,
        inApp: false,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: false,
        inApp: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.update).toHaveBeenCalledWith(
        { id: existingPreferences.id },
        {
          inApp: dto.inApp,
        },
      );
      expect(result).toEqual({
        ...existingPreferences,
        inApp: dto.inApp,
      });
    });

    it('should create new preferences if none exist', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: false,
      };

      repo.findOne.mockResolvedValue(null);
      const newPreferences = { userId: user.id, ...dto } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: dto.email,
        inApp: dto.inApp,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });

    it('should create new preferences if none exists with only one field', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
      };

      repo.findOne.mockResolvedValue(null);
      const newPreferences = { userId: user.id, ...dto } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: dto.email,
        inApp: true,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });

    it('should create new preferences if none exists with only one field', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        type: NotificationType.TRANSACTION_CREATED,
        inApp: true,
      };

      repo.findOne.mockResolvedValue(null);
      const newPreferences = { userId: user.id, ...dto } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        inApp: dto.inApp,
        email: true,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });

    it('should not update preferences if no fields are provided', async () => {
      const dto: UpdateNotificationPreferencesDto = {
        type: NotificationType.TRANSACTION_CREATED,
      };

      const existingPreferences = {
        id: 1,
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: false,
        inApp: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.updatePreferences(user, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.update).not.toHaveBeenCalled();
      expect(result).toEqual(existingPreferences);
    });
  });

  describe('getPreferenceOrCreate', () => {
    it('should return existing preferences if found', async () => {
      const user = { id: 1 } as User;
      const existingPreferences = {
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(existingPreferences);

      const result = await service.getPreferenceOrCreate(
        user,
        NotificationType.TRANSACTION_CREATED,
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(result).toEqual(existingPreferences);
    });

    it('should create new preferences if none exist', async () => {
      const user = { id: 1 } as User;
      repo.findOne.mockResolvedValue(null);
      const newPreferences = {
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: true,
      } as NotificationPreferences;
      repo.create.mockReturnValue(newPreferences);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.getPreferenceOrCreate(
        user,
        NotificationType.TRANSACTION_CREATED,
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(repo.create).toHaveBeenCalledWith({
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: true,
      });
      expect(repo.insert).toHaveBeenCalledWith(newPreferences);
      expect(result).toEqual(newPreferences);
    });
  });

  describe('getPreferencesOrCreate', () => {
    it('should return existing preferences if found', async () => {
      const user = { id: 1 } as User;
      const existingPreferences = {
        userId: user.id,
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: true,
      } as NotificationPreferences;
      repo.find.mockResolvedValue(
        Object.values(NotificationType).map(type => ({ ...existingPreferences, type })),
      );

      const result = await service.getPreferencesOrCreate(user);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
      expect(result).toEqual(
        Object.values(NotificationType).map(type => ({ ...existingPreferences, type })),
      );
    });

    it('should create new preferences if none exist', async () => {
      const user = { id: 1 } as User;
      repo.find.mockResolvedValue([]);
      const newPreferences = {
        userId: user.id,
        email: true,
        inApp: true,
      };
      repo.create.mockImplementation((data: NotificationPreferences) => data);
      repo.insert.mockResolvedValue(undefined);

      const result = await service.getPreferencesOrCreate(user);

      const types = Object.values(NotificationType);

      for (const type of types) {
        expect(repo.findOne).toHaveBeenCalledWith({
          where: { userId: user.id, type },
        });
        expect(repo.create).toHaveBeenCalledWith({
          userId: user.id,
          type,
          email: true,
          inApp: true,
        });
        expect(repo.insert).toHaveBeenCalledWith({ ...newPreferences, type });
      }

      expect(result).toEqual(types.map(type => ({ ...newPreferences, type })));
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const user = { id: 1 } as User;
      const preferences = {
        type: NotificationType.TRANSACTION_CREATED,
        email: true,
        inApp: true,
      } as NotificationPreferences;
      repo.findOne.mockResolvedValue(preferences);

      const result = await service.getPreferences(user, NotificationType.TRANSACTION_CREATED);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(result).toEqual(preferences);
    });

    it('should return null if no preferences found', async () => {
      const user = { id: 1 } as User;
      repo.findOne.mockResolvedValue(null);

      const result = await service.getPreferences(user, NotificationType.TRANSACTION_CREATED);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: user.id, type: NotificationType.TRANSACTION_CREATED },
      });
      expect(result).toBeNull();
    });
  });
});
