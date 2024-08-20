import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

import {
  Notification,
  notificationProperties,
  NotificationReceiver,
  notificationReceiverProperties,
  User,
} from '@entities';

import {
  Filtering,
  getOrder,
  getWhere,
  PaginatedResourceDto,
  Pagination,
  Sorting,
} from '@app/common';
import { UpdateNotificationReceiverDto } from './dtos';

@Injectable()
export class NotificationReceiverService {
  constructor(
    @InjectRepository(NotificationReceiver)
    private repo: Repository<NotificationReceiver>,
  ) {}

  async getReceivedNotifications(
    user: User,
    pagination: Pagination,
    sort?: Sorting[],
    filter?: Filtering[],
  ): Promise<PaginatedResourceDto<NotificationReceiver>> {
    const [items, totalItems] = await this.repo.findAndCount(
      this.getFindOptionsForNotifications(user, pagination, sort, filter),
    );

    return {
      page: pagination.page,
      size: pagination.size,
      totalItems,
      items,
    };
  }

  async getReceivedNotificationsCount(
    user: User,
    pagination: Pagination,
    sort?: Sorting[],
    filter?: Filtering[],
  ): Promise<number> {
    return await this.repo.count(
      this.getFindOptionsForNotifications(user, pagination, sort, filter),
    );
  }

  async getReceivedNotification(user: User, id: number) {
    const notificationReceiver = await this.repo.findOne({
      where: { id, userId: user.id },
      relations: {
        notification: true,
      },
    });

    if (!notificationReceiver) {
      throw new NotFoundException('Notification not found or does not belong to you');
    }

    return notificationReceiver;
  }

  async updateReceivedNotification(user: User, id: number, dto: UpdateNotificationReceiverDto) {
    const { isRead } = dto;

    const notificationReceiver = await this.getReceivedNotification(user, id);
    notificationReceiver.isRead = isRead;

    await this.repo.update(
      {
        id,
      },
      {
        isRead,
      },
    );

    return notificationReceiver;
  }

  async deleteReceivedNotification(user: User, id: number) {
    await this.getReceivedNotification(user, id);

    await this.repo.delete({
      id,
    });

    return true;
  }

  getFindOptionsForNotifications(
    user: User,
    { limit, offset }: Pagination,
    sort?: Sorting[],
    filter?: Filtering[],
  ): FindManyOptions<NotificationReceiver> {
    /* Get filtering & sorting for NotificationReceiver entity */
    const keys = notificationReceiverProperties.map(x => x.toString());
    const filterNotificationReceiver = filter?.filter(filtering =>
      keys.includes(filtering.property),
    );
    const sortNotificationReceiver = sort?.filter(sorting => keys.includes(sorting.property));
    const whereNotificationReceiver = getWhere<Notification>(filterNotificationReceiver || []);
    const orderNotificationReceiver = getOrder(sortNotificationReceiver || []);

    /* Get filtering & sorting for Notification entity */
    const keys1 = notificationProperties.map(x => x.toString());
    const filterNotification = filter?.filter(filtering => keys1.includes(filtering.property));
    const sortNotification = sort?.filter(sorting => keys1.includes(sorting.property));
    const whereNotification = getWhere<Notification>(filterNotification || []);
    const orderNotification = getOrder(sortNotification || []);

    /* Filtering */
    let where: FindOptionsWhere<NotificationReceiver> | FindOptionsWhere<NotificationReceiver>[] = {
      userId: user.id,
    };
    if (Object.keys(whereNotificationReceiver).length > 0) {
      where = {
        ...whereNotificationReceiver,
        userId: user.id,
      };
    }
    if (Object.keys(whereNotification).length > 0) {
      where = {
        ...where,
        notification: {
          ...whereNotification,
        },
      };
    }

    /* Sorting */
    let order: FindOptionsOrder<NotificationReceiver> = {};
    if (Object.keys(orderNotificationReceiver).length > 0) {
      order = {
        ...orderNotificationReceiver,
      };
    }
    if (Object.keys(orderNotification).length > 0) {
      order = {
        ...order,
        notification: {
          ...orderNotification,
        },
      };
    }

    const findOptions: FindManyOptions<NotificationReceiver> = {
      where,
      order,
      relations: {
        notification: true,
      },
      skip: offset,
      take: limit,
    };

    if (Object.keys(order).length === 0) {
      delete findOptions.order;
    }

    return findOptions;
  }
}
