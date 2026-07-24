import type {
  INotificationPreferencesCore,
  IUpdateNotificationPreferencesDto,
} from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import type { Organization } from '@prisma/client';

/* Notification preferences service for organization */

const controller = 'notification-preferences';

/* Get keys for a user from organization */
export const getUserNotificationPreferences = async (
  org: Organization,
): Promise<INotificationPreferencesCore[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(org, `${controller}`);
    return response.data;
  }, 'Failed to get user notification preferences');

/* Uploads a key to the organization */
export const updateUserNotificationPreferences = async (
  org: Organization,
  preferences: IUpdateNotificationPreferencesDto,
): Promise<INotificationPreferencesCore> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.patch(org, `${controller}`, preferences);
    return response.data;
  }, 'Failed to update user notification preferences');
