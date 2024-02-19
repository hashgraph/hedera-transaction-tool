import { Transaction } from '@hashgraph/sdk';
import { getTransactionType } from '@renderer/utils/transactions';

const transactionDraftsKey = 'transactionDrafts';

export const getRawDrafts = (): {
  id: string;
  type: string;
  routeParam: string;
  transactionBytes: string;
}[] => {
  const drafts = localStorage.getItem(transactionDraftsKey);

  return drafts ? JSON.parse(drafts) : [];
};

export const getDrafts = () => {
  const drafts = getRawDrafts().map(draft => {
    const bytesArray = draft.transactionBytes.split(',').map(n => Number(n));
    const transaction = Transaction.fromBytes(Uint8Array.from(bytesArray));

    return {
      id: draft.id,
      type: draft.type,
      routeParam: draft.routeParam,
      transaction: transaction,
    };
  });

  return drafts;
};

export const getDraft = <T extends Transaction>(
  id: string,
): { id: string; type: string; routeParam: string; transaction: T } | null => {
  const drafts = getDrafts();
  const draft = drafts.find(d => d.id === id);

  if (draft) {
    return {
      id: draft.id,
      type: draft.type,
      routeParam: draft.routeParam,
      transaction: draft.transaction as T,
    };
  } else {
    return null;
  }
};

export const addDraft = (transactionBytes: Uint8Array, routeParam: string) => {
  const drafts = getRawDrafts();

  const id = new Date().getTime().toString();

  const newDraft = {
    id,
    type: getTransactionType(transactionBytes),
    routeParam: routeParam,
    transactionBytes: transactionBytes.toString(),
  };

  drafts.push(newDraft);

  localStorage.setItem(transactionDraftsKey, JSON.stringify(drafts));
};

export const removeDraft = (id: string) => {
  let drafts = getRawDrafts();

  drafts = drafts.filter(d => d.id != id);

  localStorage.setItem(transactionDraftsKey, JSON.stringify(drafts));
};
