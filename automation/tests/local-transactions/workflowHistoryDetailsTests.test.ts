import { expect, test } from '@playwright/test';
import { DetailsPage } from '../../pages/DetailsPage.js';
import { updateLocalTransactionStatus } from '../../utils/db/databaseQueries.js';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Workflow history/detail account tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();
  let detailsPage: DetailsPage;

  test.beforeEach(async () => {
    detailsPage = new DetailsPage(suite.window);
  });

  test('Verify account create tx is displayed in history page', async () => {
    // Create multiple history items so we can verify sorting in the History table.
    const { newTransactionId: txB } = await suite.transactionPage.createNewAccount({
      description: 'B history sort',
    });
    const { newTransactionId: txA } = await suite.transactionPage.createNewAccount({
      description: 'A history sort',
    });
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnHistoryTab();

    // Assert History table column headers are present
    const headerTexts = await detailsPage.getHistoryTableHeaderTexts();
    expect(headerTexts).toContain('Transaction ID');
    expect(headerTexts).toContain('Transaction Type');
    expect(headerTexts).toContain('Description');
    expect(headerTexts).toContain('Status');
    expect(headerTexts).toContain('Created At');
    expect(headerTexts).toContain('Actions');

    const isDescriptionBefore = async (firstDescription: string, secondDescription: string) => {
      const firstIndex = await detailsPage.getHistoryDescriptionRowIndex(firstDescription);
      const secondIndex = await detailsPage.getHistoryDescriptionRowIndex(secondDescription);

      return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
    };

    // Verify sorting by Description (asc/desc)
    await detailsPage.sortHistoryByDescription();
    await detailsPage.waitForHistoryDescriptionSortDirection('asc');
    await expect.poll(() => isDescriptionBefore('A history sort', 'B history sort')).toBe(true);
    await detailsPage.sortHistoryByDescription();
    await detailsPage.waitForHistoryDescriptionSortDirection('desc');
    await expect.poll(() => isDescriptionBefore('B history sort', 'A history sort')).toBe(true);
    await detailsPage.sortHistoryByDescription();
    await detailsPage.waitForHistoryDescriptionSortDirection('asc');
    await expect.poll(() => isDescriptionBefore('A history sort', 'B history sort')).toBe(true);

    // Keep the original "is displayed" assertion for txA after sorting asc.
    const newTransactionId = txA;
    const txDescription = 'A history sort';
    const transactionIndex = await detailsPage.getHistoryDescriptionRowIndex(txDescription);
    expect(transactionIndex).toBeGreaterThanOrEqual(0);
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Create',
      txDescription,
      transactionIndex,
    );

    // 4.4.2: Status badge style (success should not be marked as danger).
    expect(await detailsPage.isTransactionStatusBadgeSuccess(transactionIndex)).toBe(true);
  });

  test('Verify history status badge shows danger styling for failed transactions', async () => {
    const { newAccountId: receiverAccountId } = await suite.transactionPage.createNewAccount({
      description: 'failed transfer receiver',
    });
    expect(receiverAccountId).toBeTruthy();

    const failedTransactionId = await suite.transactionPage.transferAmountBetweenAccounts(
      receiverAccountId ?? '',
      '1',
    );
    expect(failedTransactionId).toBeTruthy();
    expect(
      await updateLocalTransactionStatus(failedTransactionId ?? '', 'INVALID_TRANSACTION', 21),
    ).toBe(true);
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.clickOnHistoryTab();

    expect(
      await detailsPage.isTransactionStatusBadgeDangerForTransaction(failedTransactionId ?? ''),
    ).toBe(true);
  });

  test('Verify transaction details are displayed for account tx', async () => {
    const { newTransactionId } = await suite.transactionPage.createNewAccount({
      description: 'testDescription',
    });
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();

    // Assert details page route and title explicitly
    await expect.poll(() => suite.window.url()).toContain('/transaction/');
    const detailsType = await detailsPage.getTransactionDetailsType();
    expect(detailsType).toBe('Account Create');

    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Create');
    const getAccountDetailsKey = await detailsPage.getAccountDetailsKey();
    expect(getAccountDetailsKey).toBeTruthy();

    const getAccountDetailsStaking = await detailsPage.getAccountDetailsStaking();
    expect(getAccountDetailsStaking).toBe('None');

    const getAccountDetailsAcceptRewards = await detailsPage.getAccountDetailsAcceptRewards();
    expect(getAccountDetailsAcceptRewards).toBe('Yes');

    const getAccountDetailsReceiverSigRequired =
      await detailsPage.getAccountDetailsReceiverSigRequired();
    expect(getAccountDetailsReceiverSigRequired).toBe('No');

    const getAccountDetailsInitialBalance = await detailsPage.getAccountDetailsInitBalance();
    expect(getAccountDetailsInitialBalance).toBe('0 ℏ');

    const getTransactionDescription = await detailsPage.getTransactionDescription();
    expect(getTransactionDescription).toBe('testDescription');

    // Link the newly created account into local store, then verify the details view reflects that state.
    if (await detailsPage.isLinkAccountButtonVisible()) {
      await detailsPage.clickOnLinkAccountButton();
      await suite.loginPage.waitForToastToDisappear();
    }
    expect(await detailsPage.isAccountAlreadyLinkedLabelVisible()).toBe(true);
  });

  test('Verify transaction details are displayed for account update tx', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await suite.transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Update');
    const getTransactionMemo = await detailsPage.getTransactionDetailsMemo();
    expect(getTransactionMemo).toBe('Transaction memo update');

    const getAccountId = await detailsPage.getAccountUpdateDetailsId();
    expect(getAccountId).toContain(accountFromList);

    const getAccountMemoDetails = await detailsPage.getAccountDetailsMemo();
    expect(getAccountMemoDetails).toBe(updatedMemoText);
  });

  test('Verify account update tx is displayed in history page', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo again';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await suite.transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Account Update');
  });

  test('Verify account delete tx is displayed in history page', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const newTransactionId = await suite.transactionPage.deleteAccount(accountFromList);
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Account Delete');
  });

  test('Verify transaction details are displayed for account delete tx', async () => {
    await suite.transactionPage.ensureAccountExists();
    const accountFromList = await suite.transactionPage.getFirstAccountFromList();
    const newTransactionId = await suite.transactionPage.deleteAccount(accountFromList);
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Delete');
    const getDeletedAccountId = await detailsPage.getDeletedAccountId();
    expect(getDeletedAccountId).toContain(accountFromList);

    const getTransferAccountId = await detailsPage.getAccountDeleteDetailsTransferId();
    expect(getTransferAccountId).toBeTruthy();
  });
});
