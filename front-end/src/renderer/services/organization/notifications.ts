import type { INotificationReceiver, IUpdateNotificationReceiver } from '@main/shared/interfaces/organization';

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
  updateNotificationPreferencesDto: IUpdateNotificationReceiver,
): Promise<void> =>
  commonRequestHandler(async () => {
    try {
      await axiosWithCredentials.patch(
        `${organizationServerUrl}/${controller}`,
        updateNotificationPreferencesDto,
      );
    } catch (error) {
      console.log(error);
    }
  }, 'Failed to update notification');

export const updateNotifications = async (
  organizationServerUrl: string,
  updateNotificationPreferencesDtos: IUpdateNotificationReceiver[],
): Promise<void> => {
  const batchSize = 1000; // Number of items per batch
  const rateLimitPerSecond = 1000; // Server rate limit

  await processWithRateLimit(
    updateNotificationPreferencesDtos,
    batchSize,
    rateLimitPerSecond,
    async (batch) => {
      const dtos = batch.map(id => ({
        id,
        isRead: true, // Example DTO structure
      }));

      try {
        await axiosWithCredentials.patch(
          `${organizationServerUrl}/${controller}`,
          dtos,
        );
      } catch (error) {
        console.error('Failed to update batch:', error);
      }
    },
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processWithRateLimit<T>(
  items: T[],
  batchSize: number,
  rateLimitPerSecond: number,
  handler: (batch: T[]) => Promise<void>,
): Promise<void> {
  // Convert rate limit to milliseconds
  const delayBetweenBatches = 1000 / rateLimitPerSecond;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Wrap the handler call in commonRequestHandler
    await commonRequestHandler(async () => {
      await handler(batch);
    }, `Failed to process batch starting at index ${i}`);

    // Delay before processing the next batch (if not the last batch)
    if (i + batchSize < items.length) {
      await delay(delayBetweenBatches);
    }
  }
}

/* Sends email to the required signers  */
export const remindSigners = async (serverUrl: string, transactionId: number): Promise<void> =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.post(
      `${serverUrl}/${controller}/remind-signers?transactionId=${transactionId}`,
    );
  }, `Failed to remind signers for transaction transaction with id ${transactionId}`);
