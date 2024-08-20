import { NotificationType } from '../notification-receiver';
import { IUser } from '../user';

export interface INotificationPreferencesCore {
  id: number;
  userId: number;
  type: NotificationType;
  email: boolean;
  inApp: boolean;
}

export interface INotificationPreferences extends INotificationPreferencesCore {
  user: IUser;
}

export interface IUpdateNotificationPreferencesDto {
  type: NotificationType;
  email?: boolean;
  inApp?: boolean;
}
