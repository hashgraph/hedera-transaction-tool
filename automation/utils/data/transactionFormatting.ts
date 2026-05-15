/**
 * Formats the transaction ID from one format to another.
 * Converts from: 0.0.1509@1715260863.080000000
 * To: 0.0.1509-1715260863-080000000
 * Specifically converts '@' to '-' and only the first dot after the '@' to '-'
 * without affecting initial '0.0'.
 */
export function formatTransactionId(transactionId: string): string {
  let formattedId = transactionId.replace('@', '-');
  formattedId = formattedId.replace(/-(\d+)\.(\d+)/, '-$1-$2');

  return formattedId;
}

/**
 * Extracts the clean account ID from a string containing a checksum.
 * For example, "0.0.1030-bmczp" returns "0.0.1030".
 */
export function getCleanAccountId(accountIdWithChecksum: unknown): string {
  if (!accountIdWithChecksum || typeof accountIdWithChecksum !== 'string') {
    throw new Error('Invalid accountIdWithChecksum provided');
  }

  return accountIdWithChecksum.split('-')[0];
}
