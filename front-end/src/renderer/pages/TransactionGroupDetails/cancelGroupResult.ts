import type { CancelGroupResult } from '@renderer/services/organization';

export type CancelGroupToastKind = 'success' | 'warning' | 'error';

export interface CancelGroupToast {
  kind: CancelGroupToastKind;
  message: string;
}

export const getCancelGroupToast = (result: CancelGroupResult): CancelGroupToast => {
  const canceledCount = result.canceled.length;
  const alreadyCanceledCount = result.alreadyCanceled.length;
  const failedCount = result.failed.length;

  if (canceledCount === 0 && alreadyCanceledCount === 0 && failedCount === 0) {
    return { kind: 'success', message: 'No transactions to cancel' };
  }

  if (failedCount === 0 && canceledCount > 0 && alreadyCanceledCount > 0) {
    return {
      kind: 'success',
      message: `${canceledCount} canceled, ${alreadyCanceledCount} already canceled`,
    };
  }

  if (failedCount === 0 && canceledCount > 0) {
    return {
      kind: 'success',
      message: `${canceledCount} transaction(s) canceled successfully`,
    };
  }

  if (failedCount === 0 && alreadyCanceledCount > 0) {
    return {
      kind: 'success',
      message: 'All transactions were already canceled',
    };
  }

  if (failedCount > 0 && canceledCount + alreadyCanceledCount > 0) {
    return {
      kind: 'warning',
      message: `${canceledCount} canceled, ${alreadyCanceledCount} already canceled, ${failedCount} failed`,
    };
  }

  return {
    kind: 'error',
    message: 'No transactions could be canceled',
  };
};
