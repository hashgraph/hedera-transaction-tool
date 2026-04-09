import { Notification } from '@entities';
import { getNetworkString } from '@app/common/templates/index';

/**
 * Groups notifications by their `additionalData.network` field and returns an
 * HTML fragment like:
 *   "<strong>3</strong> transactions on Mainnet, <strong>1</strong> transaction on Testnet"
 *
 * Returns an empty string if no notifications carry a usable network value, so
 * callers can conditionally include the breakdown paragraph.
 *
 * Networks are ordered by count (descending), ties broken alphabetically, to
 * produce stable output for snapshot tests and for humans reading the email.
 *
 * Privacy invariant: only the integer count and the normalized network label
 * are interpolated into the returned string. Do not add any user-controlled
 * field (transactionId, validStart, statusCode) — see 2520.
 */
export const buildNetworkBreakdown = (notifications: Notification[]): string => {
  const counts = new Map<string, number>();
  for (const n of notifications) {
    const network = getNetworkString(n.additionalData?.network);
    if (!network) continue;
    counts.set(network, (counts.get(network) ?? 0) + 1);
  }

  if (counts.size === 0) return '';

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([network, count]) => {
      const noun = count === 1 ? 'transaction' : 'transactions';
      return `<strong>${count}</strong> ${noun} on ${network}`;
    })
    .join(', ');
};
