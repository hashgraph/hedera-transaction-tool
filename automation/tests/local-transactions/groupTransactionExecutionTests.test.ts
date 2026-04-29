import { expect, test } from '@playwright/test';
import { setupGroupTransactionSuite } from '../helpers/fixtures/groupTransactionSuite.js';

test.describe('Group transaction execution tests @local-transactions', () => {
  const suite = setupGroupTransactionSuite();

  test('Verify user can execute group transaction', async () => {
    await suite.groupPage.addSingleTransactionToGroup();

    await suite.groupPage.clickOnSignAndExecuteButton();
    const txId = (await suite.groupPage.getTransactionTimestamp(0)) ?? '';
    await suite.groupPage.clickOnConfirmGroupTransactionButton();
    await suite.groupAssertions.assertMirrorTransactionResult(txId, 'CRYPTOCREATEACCOUNT');
  });

  test('Verify user can execute duplicated group transactions', async () => {
    await suite.groupPage.addSingleTransactionToGroup();
    // Duplicate the transaction twice
    await suite.groupPage.clickTransactionDuplicateButton(0);
    await suite.groupPage.clickTransactionDuplicateButton(0);

    await suite.groupPage.clickOnSignAndExecuteButton();
    const txId = (await suite.groupPage.getTransactionTimestamp(0)) ?? '';
    const secondTxId = (await suite.groupPage.getTransactionTimestamp(1)) ?? '';
    const thirdTxId = (await suite.groupPage.getTransactionTimestamp(2)) ?? '';
    await suite.groupPage.clickOnConfirmGroupTransactionButton();
    await suite.groupAssertions.assertMirrorTransactionResult(txId, 'CRYPTOCREATEACCOUNT');
    await suite.groupAssertions.assertMirrorTransactionResult(secondTxId, 'CRYPTOCREATEACCOUNT');
    await suite.groupAssertions.assertMirrorTransactionResult(thirdTxId, 'CRYPTOCREATEACCOUNT');
  });

  test('Verify user can execute different transactions in a group', async () => {
    await suite.groupPage.addSingleTransactionToGroup();
    await suite.groupPage.addSingleTransactionToGroup(1, true);

    await suite.groupPage.clickOnSignAndExecuteButton();
    const txId = (await suite.groupPage.getTransactionTimestamp(0)) ?? '';
    const secondTxId = (await suite.groupPage.getTransactionTimestamp(1)) ?? '';
    await suite.groupPage.clickOnConfirmGroupTransactionButton();
    await suite.groupAssertions.assertMirrorTransactionResult(txId, 'CRYPTOCREATEACCOUNT');
    await suite.groupAssertions.assertMirrorTransactionResult(secondTxId, 'FILECREATE');
  });

  test('Verify transaction and linked group items and transaction group exists in db', async () => {
    await suite.groupPage.addSingleTransactionToGroup();
    await suite.groupPage.clickOnSignAndExecuteButton();
    const txId = (await suite.groupPage.getTransactionTimestamp(0)) ?? '';
    await suite.groupPage.clickOnConfirmGroupTransactionButton();
    await suite.transactionPage.mirrorGetTransactionResponse(txId);
    expect(await suite.groupPage.doTransactionGroupsExist(txId)).toBe(true);
  });
});
