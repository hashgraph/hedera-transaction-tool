import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  Filtering,
  FilteringParams,
  PaginatedResourceDto,
  Pagination,
  PaginationParams,
  Serialize,
  Sorting,
  SortingParams,
  withPaginatedResponse,
} from '@app/common';

import {
  notificationDateProperties,
  notificationProperties,
  NotificationReceiver,
  notificationReceiverDateProperties,
  notificationReceiverProperties,
  User,
} from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../guards';

import { GetUser } from '../decorators';

import { NotificationReceiverService } from './notification-receiver.service';

import { NotificationReceiverDto } from './dtos/notification-receiver.dto';
import { UpdateNotificationReceiverDto } from './dtos';

@ApiTags('Notification')
@Controller('notifications')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationReceiverService) {}

  @ApiOperation({
    summary: "Get user's notifications",
    description: 'Get notifications that the user has received',
  })
  @ApiResponse({
    status: 200,
    type: [NotificationReceiverDto],
  })
  @Get()
  @HttpCode(200)
  @Serialize(withPaginatedResponse(NotificationReceiverDto))
  async getNotifications(
    @GetUser() user: User,
    @PaginationParams() paginationParams: Pagination,
    @SortingParams([...notificationReceiverProperties, ...notificationProperties]) sort?: Sorting[],
    @FilteringParams({
      validProperties: [...notificationReceiverProperties, ...notificationProperties],
      dateProperties: [...notificationReceiverDateProperties, ...notificationDateProperties],
    })
    filter?: Filtering[],
  ): Promise<PaginatedResourceDto<NotificationReceiver>> {
    return this.notificationsService.getReceivedNotifications(user, paginationParams, sort, filter);
  }

  @ApiOperation({
    summary: "Get user's notifications count",
    description: 'Get the count of notifications that the user has received',
  })
  @ApiResponse({
    status: 200,
    type: Number,
  })
  @Get('/count')
  @HttpCode(200)
  async getNotificationsCount(
    @GetUser() user: User,
    @FilteringParams({
      validProperties: [...notificationReceiverProperties, ...notificationProperties],
      dateProperties: [...notificationReceiverDateProperties, ...notificationDateProperties],
    })
    filter?: Filtering[],
  ): Promise<number> {
    return this.notificationsService.getReceivedNotificationsCount(user, filter);
  }

  @ApiOperation({
    summary: "Get user's notification by notification receiver id",
    description:
      'Get notification with a given NOTIFICATION RECEIVER id that the user has received',
  })
  @ApiResponse({
    status: 200,
    type: NotificationReceiverDto,
  })
  @Get('/:id')
  @HttpCode(200)
  @Serialize(NotificationReceiverDto)
  async getReceivedNotification(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificationReceiver> {
    return this.notificationsService.getReceivedNotification(user, id);
  }

  @ApiOperation({
    summary: "Updates user's received notification",
    description:
      'Updates notification with a given NOTIFICATION RECEIVER id that the user has received',
  })
  @ApiResponse({
    status: 200,
    type: NotificationReceiverDto,
  })
  @Patch('/:id')
  @HttpCode(200)
  @Serialize(NotificationReceiverDto)
  async updateReceivedNotification(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateNotificationReceiverDto,
  ): Promise<NotificationReceiver> {
    return this.notificationsService.updateReceivedNotification(user, id, body);
  }

  @ApiOperation({
    summary: "Deletes user's notification receiver",
    description:
      'Deletes notification with a given NOTIFICATION RECEIVER id that the user has received',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Delete('/:id')
  @HttpCode(200)
  async deleteReceivedNotification(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<boolean> {
    return this.notificationsService.deleteReceivedNotification(user, id);
  }
}
