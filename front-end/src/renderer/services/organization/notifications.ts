import type {
  INotificationReceiver,
  IUpdateNotificationReceiver,
} from '@main/shared/interfaces/organization';

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
export const updateNotification = async (
  organizationServerUrl: string,
  notificationId: string,
  updateNotificationPreferencesDto: IUpdateNotificationReceiver,
): Promise<void> =>
  commonRequestHandler(async () => {
    try {
      await axiosWithCredentials.patch(
        `${organizationServerUrl}/${controller}/${notificationId}`,
        updateNotificationPreferencesDto,
      );
    } catch (error) {
      console.log(error);
    }
  }, 'Failed to update notification');

export const updateNotifications = async (
  organizationServerUrl: string,
  notificationIds: number[],
  updateNotificationPreferencesDtos: IUpdateNotificationReceiver[],
): Promise<void> =>
  commonRequestHandler(async () => {
    for (let i = 0; i < notificationIds.length; i++) {
      try {
        await axiosWithCredentials.patch(
          `${organizationServerUrl}/${controller}/${notificationIds[i]}`,
          updateNotificationPreferencesDtos[i],
        );
      } catch (error) {
        console.log(error);
      }
    }
  }, 'Failed to update notifications');
