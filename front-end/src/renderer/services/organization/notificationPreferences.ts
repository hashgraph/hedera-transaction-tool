import type {
  INotificationPreferencesCore,
  IUpdateNotificationPreferencesDto,
} from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

/* Notification preferences service for organization */

const controller = 'notification-preferences';

/* Get keys for a user from organization */
export const getUserNotificationPreferences = async (
  organizationServerUrl: string,
): Promise<INotificationPreferencesCore[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(`${organizationServerUrl}/${controller}`);
    return response.data;
  }, 'Failed to get user notification preferences');

/* Uploads a key to the organization */
export const updateUserNotificationPreferences = async (
  organizationServerUrl: string,
  preferences: IUpdateNotificationPreferencesDto,
): Promise<INotificationPreferencesCore> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.patch(
      `${organizationServerUrl}/${controller}`,
      preferences,
    );
    return response.data;
  }, 'Failed to update user notification preferences');
