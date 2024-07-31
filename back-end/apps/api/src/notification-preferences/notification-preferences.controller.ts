import { Body, Controller, Get, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';

import { NotificationPreferences, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../guards';

import { GetUser } from '../decorators';

import { NotificationPreferencesService } from './notification-preferences.service';

import { UpdateNotificationPreferencesDto, NotificationPreferencesDto } from './dtos';

@ApiTags('Notification Preferences')
@Controller('notification-preferences')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
@Serialize(NotificationPreferencesDto)
export class NotificationPreferencesController {
  constructor(private notificationPreferencesService: NotificationPreferencesService) {}

  @ApiOperation({
    summary: 'Updates the notification preferences for the current user',
    description: 'Upload a user key for the current user.',
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
    description: 'Get notification preferences for the provided user id.',
  })
  @ApiResponse({
    status: 200,
    type: NotificationPreferencesDto,
  })
  @Get()
  @HttpCode(200)
  getPreferencesOrCreate(@GetUser() user: User): Promise<NotificationPreferences> {
    return this.notificationPreferencesService.getPreferencesOrCreate(user);
  }
}
