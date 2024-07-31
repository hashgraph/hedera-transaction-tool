import { IUser } from '../user';

export interface INotificationPreferencesCore {
  id: number;
  userId: number;
  transactionRequiredSignature: boolean;
  transactionReadyForExecution: boolean;
}

export interface INotificationPreferences extends INotificationPreferencesCore {
  user: IUser;
}

export interface IUpdateNotificationPreferencesDto {
  transactionRequiredSignature?: boolean;
  transactionReadyForExecution?: boolean;
}
