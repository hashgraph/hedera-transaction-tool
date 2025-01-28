export const getTransactionSignReminderKey = (transactionId: number) => {
  return `transaction:sign:${transactionId}`;
};

export const parseTransactionSignKey = (key: string): number | null => {
  const parts = key.split(':');

  if (parts.length !== 3) {
    return null;
  }

  return parseInt(parts[2]);
};
