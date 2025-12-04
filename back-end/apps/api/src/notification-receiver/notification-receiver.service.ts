import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere, In, Repository } from 'typeorm';

import {
  Notification,
  notificationProperties,
  NotificationReceiver,
  notificationReceiverProperties,
  TransactionStatus,
  User,
} from '@entities';

import {
  emitTransactionRemindSigners,
  ErrorCodes,
  Filtering,
  getOrder,
  getWhere,
  NatsPublisherService,
  PaginatedResourceDto,
  Pagination,
  Sorting,
} from '@app/common';
import { UpdateNotificationReceiverDto } from './dtos';

import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class NotificationReceiverService {
  constructor(
    @InjectRepository(NotificationReceiver)
    private repo: Repository<NotificationReceiver>,
    private readonly notificationsPublisher: NatsPublisherService,
    private readonly transactionService: TransactionsService,
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

  async getReceivedNotificationsCount(user: User, filter?: Filtering[]): Promise<number> {
    return await this.repo.count(this.getFindOptionsForNotifications(user, null, null, filter));
  }

  async getReceivedNotification(user: User, id: number) {
    const notificationReceiver = await this.repo.findOne({
      where: { id, userId: user.id },
      relations: {
        notification: true,
      },
    });

    if (!notificationReceiver) {
      throw new BadRequestException(ErrorCodes.NNF);
    }

    return notificationReceiver;
  }

  async updateReceivedNotifications(user: User, dtos: UpdateNotificationReceiverDto[]) {
    const dtoIds = dtos.map(dto => dto.id);

    // get only the notifications that belong to the user
    const notifications = await this.repo.findBy({
      id: In(dtoIds),
      userId: user.id,
    });

    if (notifications.length === 0) {
      throw new BadRequestException(ErrorCodes.NNF);
    }

    // set up filter to ensure only to include dtos that are in the notifications
    const notificationIds = new Set(notifications.map(notification => notification.id));

    const updates = dtos.reduce((map, dto) => {
      if (notificationIds.has(dto.id)) {
        if (!map.has(dto.isRead)) {
          map.set(dto.isRead, []);
        }
        map.get(dto.isRead)!.push(dto.id);
      }
      return map;
    }, new Map<boolean, number[]>());

    for (const [isRead, ids] of updates) {
      if (ids.length > 0) {
        await this.repo.update(
          { id: In(ids) },
          { isRead },
        );
      }
    }

    const allIds = [...updates.values()].flat();

    // Get only the updated notifications fresh from the database
    return await this.repo.findBy({
      id: In(allIds),
      userId: user.id,
    });
  }

  async deleteReceivedNotification(user: User, id: number) {
    await this.getReceivedNotification(user, id);

    await this.repo.delete({
      id,
    });

    return true;
  }

  async remindSigners(user: User, transactionId: number) {
    const transaction = await this.transactionService.getTransactionForCreator(transactionId, user);

    if (!transaction) {
      throw new BadRequestException(ErrorCodes.TNF);
    }

    /* Check if transaction is still waiting for signatures */
    if (transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES) {
      return;
    }

    emitTransactionRemindSigners(
      this.notificationsPublisher,
      [{
        entityId: transaction.id,
        additionalData: {
          transactionId: transaction.transactionId,
          network: transaction.mirrorNetwork
        }
      }],
    );
  }

  getFindOptionsForNotifications(
    user: User,
    pagination?: Pagination,
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
    };

    if (pagination && typeof pagination.offset === 'number') {
      findOptions.skip = pagination.offset;
    }
    if (pagination && typeof pagination.limit === 'number') {
      findOptions.take = pagination.limit;
    }

    if (Object.keys(order).length === 0) {
      delete findOptions.order;
    }

    return findOptions;
  }
}
