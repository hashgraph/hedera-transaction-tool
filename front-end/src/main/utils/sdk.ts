export const getStatusCodeFromMessage = (message: string) => {
  if (message.includes('TRANSACTION_EXPIRED')) {
    return 4;
  } else {
    return 21;
  }
};
