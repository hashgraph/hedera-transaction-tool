import type { INotificationReceiver, IUpdateNotificationReceiver } from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import { createLogger } from '@renderer/utils/logger';
import type { Organization } from '@prisma/client';

const logger = createLogger('renderer.organization.notifications');

/* Notification service for organization */

const controller = 'notifications';

/* Get keys for a user from organization */
export const getAllInAppNotifications = async (
  organization: Organization,
  onlyNew: boolean,
): Promise<INotificationReceiver[]> =>
  commonRequestHandler(async () => {
    const notifications: INotificationReceiver[] = [];

    try {
      let page = 1;
      const pageSize = 100;
      let final = false;
      while (!final) {
        const paginationQuery = `page=${page}&size=${pageSize}`;
        let filterQuery = `filter=isInAppNotified:isnotnull`;

        if (onlyNew) {
          filterQuery = filterQuery += `&filter=isRead:eq:false`;
        }

        const { data } = await axiosWithCredentials.get(
          organization,
          `${controller}?${paginationQuery}&${filterQuery}`,
        );
        const totalItems = data.totalItems;

        notifications.push(...data.items);
        final = notifications.length >= totalItems;
        page++;
      }
    } catch {
      return notifications;
    }
    return notifications;
  }, 'Failed to get user notifications');

/* Update notification */
export const updateNotifications = async (
  organization: Organization,
  notificationsToUpdate: IUpdateNotificationReceiver[],
): Promise<void> =>
  commonRequestHandler(async () => {
    try {
      const batchSize = 500;
      for (let i = 0; i < notificationsToUpdate.length; i += batchSize) {
        const batch = notificationsToUpdate.slice(i, i + batchSize);
        await axiosWithCredentials.patch(organization, `${controller}`, batch);
      }
    } catch (error) {
      logger.error('Failed to update notifications', { error });
    }
  }, 'Failed to update notifications');

/* Sends email to the required signers  */
export const remindSigners = async (
  organization: Organization,
  transactionId: number,
): Promise<void> =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.post(
      organization,
      `${controller}/remind-signers?transactionId=${transactionId}`,
    );
  }, `Failed to remind signers for transaction transaction with id ${transactionId}`);
