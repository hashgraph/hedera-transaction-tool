export type TransactionAction = 'cancel' | 'archive' | 'execute' | 'remindSigners';

export const shouldRefreshAfterActionAttempt = (action: TransactionAction): boolean =>
  action === 'cancel';

interface ExecuteTransactionActionFlowParams {
  action: TransactionAction;
  execute: () => Promise<void>;
  refresh: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onRefreshError?: (error: unknown) => void;
}

export const executeTransactionActionFlow = async ({
  action,
  execute,
  refresh,
  onSuccess,
  onError,
  onRefreshError,
}: ExecuteTransactionActionFlowParams): Promise<void> => {
  try {
    await execute();
    if (!shouldRefreshAfterActionAttempt(action)) {
      await refresh();
    }
    onSuccess();
  } catch (error) {
    onError(error);
  } finally {
    if (shouldRefreshAfterActionAttempt(action)) {
      try {
        await refresh();
      } catch (refreshError) {
        onRefreshError?.(refreshError);
      }
    }
  }
};
