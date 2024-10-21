import { Body, Controller, Get, HttpCode, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';

import { NotificationPreferences, NotificationType, User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard } from '../guards';

import { GetUser } from '../decorators';

import { NotificationPreferencesService } from './notification-preferences.service';

import { UpdateNotificationPreferencesDto, NotificationPreferencesDto } from './dtos';
import { EnumValidationPipe } from '@app/common/pipes';

@ApiTags('Notification Preferences')
@Controller('notification-preferences')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard)
@Serialize(NotificationPreferencesDto)
export class NotificationPreferencesController {
  constructor(private notificationPreferencesService: NotificationPreferencesService) {}

  @ApiOperation({
    summary: 'Updates the notification preferences for the current user',
    description:
      'Updates the notification preferences for the current user. If the preferences do not exist, they will be created.',
  })
  @ApiResponse({
    status: 200,
    type: NotificationPreferencesDto,
  })
  @Patch()
  @HttpCode(200)
  updatePreferences(
    @GetUser() user: User,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.notificationPreferencesService.updatePreferences(user, body);
  }

  @ApiOperation({
    summary: "Get user's notification preferences",
    description:
      'Get notification preferences for the provided user id. If the preferences do not exist, they will be created and be all true by default.',
  })
  @ApiResponse({
    status: 200,
    type: [NotificationPreferencesDto],
  })
  @Get()
  @HttpCode(200)
  async getPreferencesOrCreate(
    @GetUser() user: User,
    @Query('type', new EnumValidationPipe<NotificationType>(NotificationType, true))
    type?: NotificationType,
  ): Promise<NotificationPreferences[]> {
    if (type) {
      return [await this.notificationPreferencesService.getPreferenceOrCreate(user, type)];
    } else {
      return this.notificationPreferencesService.getPreferencesOrCreate(user);
    }
  }
}
