import { TransactionStatus } from '@shared/interfaces';
import type { IGroupItem, CancelGroupResult } from './transactionGroup';
import { CancelFailureCode } from './transactionGroup';
import { isInProgressStatus } from '@renderer/utils/transactionStatusGuards';

export async function cancelGroupFallback(
  serverUrl: string,
  groupItems: IGroupItem[],
  cancelOne: (serverUrl: string, id: number) => Promise<boolean>,
): Promise<CancelGroupResult> {
  const canceled: number[] = [];
  const alreadyCanceled: number[] = [];
  const failed: CancelGroupResult['failed'] = [];

  for (const item of groupItems) {
    const txId = item.transactionId;
    const status = item.transaction?.status;

    if (status === TransactionStatus.CANCELED) {
      alreadyCanceled.push(txId);
      continue;
    }

    if (!isInProgressStatus(status)) {
      failed.push({
        id: txId,
        code: CancelFailureCode.NOT_CANCELABLE,
        message: `Transaction is in non-cancelable status: ${status}`,
      });
      continue;
    }

    try {
      await cancelOne(serverUrl, txId);
      canceled.push(txId);
    } catch (error) {
      failed.push({
        id: txId,
        code: CancelFailureCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to cancel transaction',
      });
    }
  }

  const processedCount = canceled.length + alreadyCanceled.length + failed.length;

  return {
    canceled,
    alreadyCanceled,
    failed,
    summary: {
      processedCount,
      canceled: canceled.length,
      alreadyCanceled: alreadyCanceled.length,
      failed: failed.length,
    },
  };
}
