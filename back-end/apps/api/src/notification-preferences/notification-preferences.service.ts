import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { NotificationPreferences, User } from '@entities';

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
    const updateTxReqSignature = typeof dto.transactionRequiredSignature === 'boolean';
    const updateTxReadyForExecution = typeof dto.transactionReadyForExecution === 'boolean';

    const updatePreferences: DeepPartial<NotificationPreferences> = {};

    if (updateTxReqSignature) {
      updatePreferences.transactionRequiredSignature = dto.transactionRequiredSignature;
    }
    if (updateTxReadyForExecution) {
      updatePreferences.transactionReadyForExecution = dto.transactionReadyForExecution;
    }

    const preferences = await this.getPreferences(user);

    if (preferences) {
      await this.repo.update(
        {
          id: preferences.id,
        },
        updatePreferences,
      );

      preferences.transactionRequiredSignature = updateTxReqSignature
        ? dto.transactionRequiredSignature
        : preferences.transactionRequiredSignature;
      preferences.transactionReadyForExecution = updateTxReadyForExecution
        ? dto.transactionReadyForExecution
        : preferences.transactionReadyForExecution;

      return preferences;
    }

    const newPreferences = this.repo.create({
      userId: user.id,
      transactionRequiredSignature:
        typeof updatePreferences.transactionRequiredSignature === 'boolean'
          ? updatePreferences.transactionRequiredSignature
          : true,
      transactionReadyForExecution:
        typeof updatePreferences.transactionReadyForExecution === 'boolean'
          ? updatePreferences.transactionReadyForExecution
          : true,
    });

    await this.repo.insert(newPreferences);

    return newPreferences;
  }

  async getPreferencesOrCreate(user: User): Promise<NotificationPreferences> {
    const preferences = await this.getPreferences(user);

    if (preferences) return preferences;

    const newPreferences = this.repo.create({
      userId: user.id,
      transactionRequiredSignature: true,
      transactionReadyForExecution: true,
    });

    await this.repo.insert(newPreferences);

    return newPreferences;
  }

  async getPreferences(user: User): Promise<NotificationPreferences> {
    return this.repo.findOne({
      where: {
        userId: user.id,
      },
    });
  }
}
