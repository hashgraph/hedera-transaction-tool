import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { NotificationPreferences, NotificationType, User } from '@entities';

import { UpdateNotificationPreferencesDto } from './dtos';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreferences) private repo: Repository<NotificationPreferences>,
  ) {}

  async updatePreferences(
    user: User,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const updateTxEmail = typeof dto.email === 'boolean';
    const updateTxInApp = typeof dto.inApp === 'boolean';

    const updatePreferences: DeepPartial<NotificationPreferences> = {};

    if (updateTxEmail) {
      updatePreferences.email = dto.email;
    }
    if (updateTxInApp) {
      updatePreferences.inApp = dto.inApp;
    }

    const preferences = await this.getPreferences(user, dto.type);

    if (!updateTxEmail && !updateTxInApp) return preferences;

    if (preferences) {
      await this.repo.update(
        {
          id: preferences.id,
        },
        updatePreferences,
      );

      preferences.email = updateTxEmail ? dto.email : preferences.email;
      preferences.inApp = updateTxInApp ? dto.inApp : preferences.inApp;

      return preferences;
    }

    const newPreferences = this.repo.create({
      userId: user.id,
      type: dto.type,
      email: typeof updatePreferences.email === 'boolean' ? updatePreferences.email : true,
      inApp: typeof updatePreferences.inApp === 'boolean' ? updatePreferences.inApp : true,
    });

    await this.repo.insert(newPreferences);

    return newPreferences;
  }

  async getPreferenceOrCreate(
    user: User,
    type: NotificationType,
  ): Promise<NotificationPreferences> {
    const preferences = await this.getPreferences(user, type);

    if (preferences) return preferences;

    const newPreferences = this.repo.create({
      userId: user.id,
      type,
      email: true,
      inApp: true,
    });

    await this.repo.insert(newPreferences);

    return newPreferences;
  }

  async getPreferencesOrCreate(user: User): Promise<NotificationPreferences[]> {
    const types = Object.values(NotificationType);
    const preferences: NotificationPreferences[] = await this.repo.find({
      where: {
        userId: user.id,
      },
    });

    const missingTypes = types.filter(t => !preferences.some(p => p.type === t));

    for (const type of missingTypes) {
      preferences.push(await this.getPreferenceOrCreate(user, type));
    }

    return preferences;
  }

  async getPreferences(user: User, type: NotificationType): Promise<NotificationPreferences> {
    return this.repo.findOne({
      where: {
        userId: user.id,
        type,
      },
    });
  }
}
