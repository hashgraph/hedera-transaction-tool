import type { Transfer } from '@hashgraph/sdk';

import { stringifyHbarWithFont } from './index';

export function formatHbarTransfers(transfers: Transfer[]): string {
  if (transfers.length === 0) {
    return 'No transfers';
  }

  if (transfers.length === 1) {
    const amount = transfers[0].amount;
    if (amount.isNegative()) {
      return 'Missing receiver';
    } else {
      return 'Missing sender';
    }
  }

  if (transfers.length === 2) {
    // the JS SDK sorts the order of the transfers by account ID. We don't want this. We want the sender to be on the
    // left and the receiver to be on the right. So we need to check if the amount is negative or positive and then
    // arrange the transfers accordingly
    let sender = transfers[0];
    let receiver = transfers[1];
    if (receiver.amount.isNegative()) {
      sender = transfers[1];
      receiver = transfers[0];
    }
    return `${sender.accountId} --> ${stringifyHbarWithFont(
      receiver.amount,
      'text-bold text-secondary',
    )} --> ${receiver.accountId}`;
  }

  return 'Multiple transfers';
}
