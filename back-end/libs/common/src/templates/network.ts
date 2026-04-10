import { Notification } from '@entities';
import { getNetworkString } from '@app/common/templates/index';

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
