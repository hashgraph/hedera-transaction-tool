import type { INotificationReceiver, ITransaction } from '@main/shared/interfaces';
import { NotificationType, TransactionStatus } from '@main/shared/interfaces';

export const getNotifiedTransactions = (
  notifications: INotificationReceiver[],
  transactions: ITransaction[],
  indicatorTypes: NotificationType[],
): number[] => {
  const indicatorNotifications = notifications.filter(nr =>
    indicatorTypes.includes(nr.notification.type),
  );

  if (indicatorNotifications.length > 0) {
    return transactions
      .filter(t => {
        return indicatorNotifications.some(nr => nr.notification.entityId === t.id);
      })
      .map(t => t.id);
  }

  return [];
};

export function countWaitingForSignatures(txList: { transactionRaw: ITransaction }[]): number {
  return txList.reduce(
    (count, tx) =>
      tx.transactionRaw.status === TransactionStatus.WAITING_FOR_SIGNATURES ? count + 1 : count,
    0,
  );
}
