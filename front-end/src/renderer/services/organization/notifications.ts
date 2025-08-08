import type {
  INotificationReceiver,
  IUpdateNotificationReceiver,
} from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

/* Notification service for organization */

const controller = 'notifications';

/* Get keys for a user from organization */
export const getAllInAppNotifications = async (
  organizationServerUrl: string,
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
          `${organizationServerUrl}/${controller}?${paginationQuery}&${filterQuery}`,
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
  organizationServerUrl: string,
  notificationsToUpdate: IUpdateNotificationReceiver[],
): Promise<void> =>
  commonRequestHandler(async () => {
    try {
      const batchSize = 500;
      for (let i = 0; i < notificationsToUpdate.length; i += batchSize) {
        const batch = notificationsToUpdate.slice(i, i + batchSize);
        await axiosWithCredentials.patch(
          `${organizationServerUrl}/${controller}`,
          batch,
        );
      }
    } catch (error) {
      console.log(error);
    }
  }, 'Failed to update notifications');

/* Sends email to the required signers  */
export const remindSigners = async (serverUrl: string, transactionId: number): Promise<void> =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.post(
      `${serverUrl}/${controller}/remind-signers?transactionId=${transactionId}`,
    );
  }, `Failed to remind signers for transaction transaction with id ${transactionId}`);
