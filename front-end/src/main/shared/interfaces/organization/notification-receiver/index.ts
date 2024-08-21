export enum NotificationType {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_WAITING_FOR_SIGNATURES = 'TRANSACTION_WAITING_FOR_SIGNATURES',
  TRANSACTION_READY_FOR_EXECUTION = 'TRANSACTION_READY_FOR_EXECUTION',
  TRANSCATION_EXECUTED = 'TRANSCATION_EXECUTED',
  TRANSCATION_EXPIRED = 'TRANSCATION_EXPIRED',
  TRANSACTION_INDICATOR_APPROVE = 'TRANSACTION_INDICATOR_APPROVE',
  TRANSACTION_INDICATOR_SIGN = 'TRANSACTION_INDICATOR_SIGN',
  TRANSACTION_INDICATOR_EXECUTABLE = 'TRANSACTION_INDICATOR_EXECUTABLE',
  TRANSACTION_INDICATOR_EXECUTED = 'TRANSACTION_INDICATOR_EXECUTED',
  TRANSACTION_INDICATOR_EXPIRED = 'TRANSACTION_INDICATOR_EXPIRED',
}

export interface INotificationReceiverCore {
  id: number;
  notificationId: number;
  isRead: boolean;
}

export interface INotificationReceiver extends INotificationReceiverCore {
  notification: INotification;
}

export interface INotification {
  id: number;
  type: NotificationType;
  content: string;
  entityId?: number;
  actorId?: number;
  isEmailSent?: boolean;
  createdAt: Date;
}

export interface IUpdateNotificationReceiver {
  isRead: boolean;
}
