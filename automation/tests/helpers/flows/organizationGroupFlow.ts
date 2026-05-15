import { expect } from '@playwright/test';
import type { GroupPage } from '../../../pages/GroupPage.js';
import type { LoginPage } from '../../../pages/LoginPage.js';
import type { OrganizationPage, UserDetails } from '../../../pages/OrganizationPage.js';
import type { TransactionPage } from '../../../pages/TransactionPage.js';
import { signInOrganizationUser } from '../support/organizationAuthSupport.js';

export interface ExecuteOrganizationGroupFromCsvFileOptions {
  groupPage: GroupPage;
  loginPage: LoginPage;
  organizationPage: OrganizationPage;
  transactionPage: TransactionPage;
  firstUser: UserDetails;
  encryptionPassword: string;
  senderAccountId: string;
  receiverAccountId: string;
  numberOfTransactions: number;
  signAll: boolean;
  description?: string;
}

export async function executeOrganizationGroupFromCsvFile({
  groupPage,
  loginPage,
  organizationPage,
  transactionPage,
  firstUser,
  encryptionPassword,
  senderAccountId,
  receiverAccountId,
  numberOfTransactions,
  signAll,
  description = 'test',
}: ExecuteOrganizationGroupFromCsvFileOptions): Promise<boolean> {
  await groupPage.fillDescription(description);
  await groupPage.generateAndImportCsvFile(
    senderAccountId,
    receiverAccountId,
    numberOfTransactions,
  );
  const message = await groupPage.getToastMessage();
  expect(message).toBe('Import complete');

  await groupPage.clickOnSignAndExecuteButton();
  await groupPage.closeGroupDraftModal();
  await groupPage.clickOnConfirmGroupTransactionButton();
  await groupPage.clickOnSignAllButton(numberOfTransactions >= 100 ? 3000 : 600);
  await groupPage.clickOnConfirmSignAllButton();
  await loginPage.waitForToastToDisappear();

  await transactionPage.clickOnTransactionsMenuButton();
  await organizationPage.logoutFromOrganization();
  await groupPage.logInAndSignGroupTransactionsByAllUsers(encryptionPassword, signAll);
  await signInOrganizationUser(organizationPage, firstUser, encryptionPassword);

  await transactionPage.clickOnTransactionsMenuButton();
  await organizationPage.clickOnHistoryTab();
  const timestamps = await groupPage.getAllTransactionTimestamps(numberOfTransactions, 100);
  return groupPage.verifyAllTransactionsAreSuccessful(timestamps);
}
