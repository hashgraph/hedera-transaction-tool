import type { GroupPage } from '../../../pages/GroupPage.js';
import type { TransactionPage } from '../../../pages/TransactionPage.js';

export interface PrepareGroupTransactionPageOptions {
  transactionPage: TransactionPage;
  groupPage: GroupPage;
  closePostNavigationModals?: boolean;
}

export async function prepareGroupTransactionPage({
  transactionPage,
  groupPage,
  closePostNavigationModals = false,
}: PrepareGroupTransactionPageOptions) {
  await transactionPage.clickOnTransactionsMenuButton();

  if (process.env.CI) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await groupPage.closeDraftTransactionModal();
  await groupPage.closeGroupDraftModal();
  await groupPage.deleteGroupModal();
  await groupPage.navigateToGroupTransaction();

  if (closePostNavigationModals) {
    await groupPage.closeGroupDraftModal();
    await groupPage.deleteGroupModal();
  }
}
