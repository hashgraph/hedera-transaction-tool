import * as path from 'path';
import * as fsp from 'fs/promises';

import { expect, test } from '@playwright/test';

import { DetailsPage } from '../../pages/DetailsPage.js';
import { clearDialogMockState, setDialogMockState } from '../../utils/runtime/dialogMocks.js';
import { waitAndReadFile } from '../../utils/files/fileWait.js';
import { setupGroupTransactionSuite } from '../helpers/fixtures/groupTransactionSuite.js';

test.describe('Group transaction export and navigation tests @local-transactions', () => {
  const suite = setupGroupTransactionSuite();

  /**
   * 7.5.5 — Export group as .tx (V1 format)
   *
   * After executing a group transaction the app redirects local users to the
   * Transactions / History tab. From there, open the first transaction's detail
   * page and use the "Export (Transaction Tool 1.0)" button to save a .tx file.
   * The personal password is already cached from login, so no password modal
   * appears.  The Electron save-dialog is intercepted via the dialog-mock API.
   */
  test('7.5.5 Export group transaction as .tx (V1 format)', async () => {
    const exportDir = path.join('/tmp', `group-export-${Date.now()}`);
    const exportPath = path.join(exportDir, 'group-transaction.tx');

    await fsp.mkdir(exportDir, { recursive: true });

    try {
      // Add one account-create transaction to the group and execute it.
      await suite.groupPage.addSingleTransactionToGroup();
      await suite.groupPage.clickOnSignAndExecuteButton();
      await suite.groupPage.clickOnConfirmGroupTransactionButton();

      // After execution the app auto-navigates back to the Transactions page.
      // Wait for the History tab button to be available, then open it.
      await suite.transactionPage.waitForElementToBeVisible(
        suite.transactionPage.historyTabSelector,
        suite.groupPage.getVeryLongTimeout(),
      );
      await suite.transactionPage.clickOnHistoryTab();

      // Pre-configure the dialog mock so the native save dialog is bypassed.
      await setDialogMockState(suite.window, { savePath: exportPath });

      // Open the first transaction's detail page from history.
      const detailsPage = new DetailsPage(suite.window);
      await detailsPage.clickOnFirstTransactionDetailsButton();

      // Click "Export (Transaction Tool 1.0)".  The ActionController reads the
      // cached personal password directly, skipping the password modal.
      await suite.transactionPage.click('button-export-transaction-to-v1');

      // Wait up to LONG_TIMEOUT for the file to appear on disk.
      const fileContent = await waitAndReadFile(exportPath, suite.groupPage.getLongTimeout());

      expect(fileContent.length).toBeGreaterThan(0);
      expect(path.extname(exportPath)).toBe('.tx');
    } finally {
      await clearDialogMockState(suite.window);
      await fsp.rm(exportDir, { recursive: true, force: true });
    }
  });

  /**
   * 7.6.2 — User can navigate between transactions in the group
   *
   * Execute a group containing two transactions. From the History tab navigate
   * into the first transaction's detail page, verify the type heading is shown,
   * then use the NextTransactionCursor "next" button to reach the second
   * transaction and verify the heading is still visible.
   */
  test('7.6.2 User can navigate between transactions in the group', async () => {
    // Add two account-create transactions to the group and execute both.
    await suite.groupPage.addSingleTransactionToGroup(2);
    await suite.groupPage.clickOnSignAndExecuteButton();
    await suite.groupPage.clickOnConfirmGroupTransactionButton();

    // Wait for the auto-navigation back to the Transactions page.
    await suite.transactionPage.waitForElementToBeVisible(
      suite.transactionPage.historyTabSelector,
      suite.groupPage.getVeryLongTimeout(),
    );
    await suite.transactionPage.clickOnHistoryTab();

    // Open the first transaction from history.
    const detailsPage = new DetailsPage(suite.window);
    await detailsPage.clickOnFirstTransactionDetailsButton();

    // Confirm we are on a transaction detail page.
    expect(
      await suite.transactionPage.isElementVisible('h2-transaction-type'),
    ).toBe(true);

    // The NextTransactionCursor is rendered only when the collection has more
    // than one entry. With two group items in history it should be present.
    expect(
      await suite.transactionPage.isElementVisible('button-next-org-transaction'),
    ).toBe(true);

    // Navigate to the next transaction in the collection.
    await suite.transactionPage.click('button-next-org-transaction');

    // The detail heading must still be visible on the second transaction.
    expect(
      await suite.transactionPage.isElementVisible('h2-transaction-type'),
    ).toBe(true);
  });
});
