export type TransactionAction = 'cancel' | 'archive' | 'execute' | 'remindSigners';

interface ExecuteTransactionActionFlowParams {
  action: TransactionAction;
  execute: () => Promise<void>;
  refresh: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onRefreshError?: (error: unknown) => void;
}

export const executeTransactionActionFlow = async (
  params: ExecuteTransactionActionFlowParams,
): Promise<void> => {
  let failed = false;
  try {
    await params.execute();
    await params.refresh();
    params.onSuccess();
  } catch (error) {
    failed = true;
    params.onError(error);
  } finally {
    if (failed) {
      try {
        await params.refresh();
      } catch (refreshError) {
        params.onRefreshError?.(refreshError);
      }
    }
  }
};
