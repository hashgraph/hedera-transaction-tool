export type TransactionAction = 'cancel' | 'archive' | 'execute' | 'remindSigners';

interface ExecuteTransactionActionFlowParams {
  execute: () => Promise<void>;
  refresh: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onRefreshError?: (error: unknown) => void;
}

export const executeTransactionActionFlow = async (
  params: ExecuteTransactionActionFlowParams,
): Promise<void> => {
  let executeFailed = false;
  try {
    await params.execute();
  } catch (error) {
    executeFailed = true;
    params.onError(error);
  }

  try {
    await params.refresh();
  } catch (refreshError) {
    params.onRefreshError?.(refreshError);
  }

  if (!executeFailed) {
    params.onSuccess();
  }
};
