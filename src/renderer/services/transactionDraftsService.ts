import { getTransactionType } from '@renderer/utils/transactions';

const transactionDraftsKey = 'transactionDrafts';

export const getDrafts = (): {
  id: string;
  type: string;
  transactionBytes: Uint8Array;
}[] => {
  const drafts = localStorage.getItem(transactionDraftsKey);

  return drafts ? JSON.parse(drafts) : [];
};

export const getDraft = (id: string) => {
  const drafts = getDrafts();

  return drafts.find(d => d.id === id);
};

export const addDraft = (transactionBytes: Uint8Array) => {
  const drafts = getDrafts();

  const id = Array.from(transactionBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const newDraft = {
    id,
    type: getTransactionType(transactionBytes),
    transactionBytes,
  };

  drafts.push(newDraft);

  localStorage.setItem(transactionDraftsKey, JSON.stringify(drafts));
};

export const removeDraft = (id: string) => {
  let drafts = getDrafts();

  drafts = drafts.filter(d => d.id != id);

  localStorage.setItem(transactionDraftsKey, JSON.stringify(drafts));
};
