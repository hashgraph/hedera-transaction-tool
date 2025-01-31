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

export function countWaitingForSignatures(
  transactions: Map<
    number,
    {
      transactionRaw: ITransaction;
    }[]
  >,
): number {
  return Array.from(transactions)
    .filter(group => group[0] !== -1)
    .flatMap(group => group[1].map(tx => tx.transactionRaw))
    .reduce(
      (count, tx) => (tx.status === TransactionStatus.WAITING_FOR_SIGNATURES ? count + 1 : count),
      0,
    );
}
