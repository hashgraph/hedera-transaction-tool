import { Hbar, type Transfer } from '@hiero-ledger/sdk';

import { stringifyHbarOrTinybar } from './index';

export function formatHbarTransfers(transfers: Transfer[]): string {
  const senders = transfers.filter(transfer => transfer.amount.isNegative());
  const receivers = transfers.filter(transfer => transfer.amount.toBigNumber().isGreaterThan(0));

  if (senders.length === 0 && receivers.length === 0) {
    return 'No transfers';
  }
  if (senders.length === 0) {
    return 'Missing sender';
  }
  if (receivers.length === 0) {
    return 'Missing receiver';
  }

  const totalCredit = receivers.reduce(
    (total, transfer) => total.plus(transfer.amount.toBigNumber()),
    new Hbar(0).toBigNumber(),
  );
  const totalDebit = senders.reduce(
    (total, transfer) => total.plus(transfer.amount.toBigNumber()),
    new Hbar(0).toBigNumber(),
  );
  if (!totalCredit.plus(totalDebit).isZero()) {
    return 'Unbalanced transfers';
  }

  if (senders.length > 1) {
    return 'Multiple transfers';
  }

  const accounts = (entries: Transfer[]) => {
    const ids = [...new Set(entries.map(transfer => transfer.accountId.toString()))];
    const others = ids.length - 1;
    return ids[0] + (others > 0 ? ` and ${others} other account${others === 1 ? '' : 's'}` : '');
  };

  return `${accounts(senders)} → ${stringifyHbarOrTinybar(new Hbar(totalCredit))} → ${accounts(receivers)}`;
}
