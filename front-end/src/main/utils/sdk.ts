export const getStatusCodeFromMessage = (message: string): number | null => {
  if (message.includes('TRANSACTION_EXPIRED')) {
    return 4;
  } else {
    return null;
  }
};
