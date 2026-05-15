import type { GroupPage } from '../../../pages/GroupPage.js';
import type { TransactionPage } from '../../../pages/TransactionPage.js';

export interface GroupAccountCreateDraftValues {
  initialFunds: string;
  maxAutoTokenAssociation: string;
  transactionMemo: string;
  accountMemo: string;
}

export const DEFAULT_GROUP_ACCOUNT_CREATE_DRAFT_VALUES: GroupAccountCreateDraftValues = {
  initialFunds: '50',
  maxAutoTokenAssociation: '10',
  transactionMemo: 'test memo',
  accountMemo: 'test account memo',
};

export async function addAndEditAccountCreateGroupTransaction(
  groupPage: GroupPage,
  transactionPage: TransactionPage,
  values: GroupAccountCreateDraftValues = DEFAULT_GROUP_ACCOUNT_CREATE_DRAFT_VALUES,
) {
  await groupPage.addSingleTransactionToGroup();
  await groupPage.clickTransactionEditButton(0);
  await transactionPage.fillInInitialFunds(values.initialFunds);
  await transactionPage.fillInMaxAccountAssociations(values.maxAutoTokenAssociation);
  await transactionPage.fillInTransactionMemoUpdate(values.transactionMemo);
  await transactionPage.fillInMemo(values.accountMemo);
  await groupPage.clickAddToGroupButton();

  return values;
}
