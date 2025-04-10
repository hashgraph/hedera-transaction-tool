import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

import {
  Notification,
  notificationProperties,
  NotificationReceiver,
  notificationReceiverProperties,
  TransactionStatus,
  User,
} from '@entities';

import {
  ErrorCodes,
  Filtering,
  getOrder,
  getRemindSignersDTO,
  getWhere,
  keysRequiredToSign,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  notifyGeneral,
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
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: ClientProxy,
    private readonly transactionService: TransactionsService,
    private readonly mirrorNodeService: MirrorNodeService,
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
    return await Promise.all(
      dtos.map(async ({id, isRead}) => {
        const notificationReceiver = await this.getReceivedNotification(user, id);
        notificationReceiver.isRead = isRead;

        await this.repo.update({id}, {isRead});

        return notificationReceiver;
      }),
    );
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

    /* Get users required to sign */
    const allKeys = await keysRequiredToSign(
      transaction,
      this.mirrorNodeService,
      this.repo.manager,
    );
    const userIds = allKeys
      .map(k => k.userId)
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(Boolean);

    const dto = getRemindSignersDTO(transaction, userIds, true, true);
    await notifyGeneral(
      this.notificationsService,
      dto.type,
      userIds,
      dto.content,
      dto.entityId,
      dto.recreateReceivers,
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
