import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction draft lifecycle tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify user can save draft and is visible in the draft page', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();
    await suite.transactionPage.fillInDescription('B draft sort');
    await suite.transactionPage.saveDraft();

    // Create a second draft so we can verify sorting in the Drafts table.
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();
    await suite.transactionPage.fillInDescription('A draft sort');
    await suite.transactionPage.saveDraft();

    const draftDate = await suite.transactionPage.getFirstDraftDate();
    expect(draftDate).toBeTruthy();

    const draftType = await suite.transactionPage.getFirstDraftType();
    expect(draftType).toBe('Account Create');

    const description = await suite.transactionPage.getFirstDraftDescription();
    expect(['A draft sort', 'B draft sort']).toContain(description);

    // Cleanup both drafts
    await suite.transactionPage.deleteFirstDraft();
    await suite.transactionPage.deleteFirstDraft();
  });

  test('Verify user can delete a draft transaction', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();
    await suite.transactionPage.saveDraft();

    await suite.transactionPage.deleteFirstDraft();

    const isContinueButtonHidden = await suite.transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify draft transaction is no longer visible after we execute the tx', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();
    await suite.transactionPage.waitForPublicKeyToBeFilled();
    await suite.transactionPage.saveDraft();

    await suite.transactionPage.clickOnFirstDraftContinueButton();
    await suite.transactionPage.createNewAccount({}, true);
    await suite.transactionPage.clickOnTransactionsMenuButton();

    const isContinueButtonHidden = await suite.transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify draft transaction is visible after we execute the tx and we have template checkbox selected', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();
    await suite.transactionPage.waitForPublicKeyToBeFilled();
    await suite.transactionPage.saveDraft();

    await suite.transactionPage.clickOnFirstDraftIsTemplateCheckbox();
    await suite.transactionPage.clickOnFirstDraftContinueButton();
    await suite.transactionPage.createNewAccount({}, true);
    await suite.transactionPage.clickOnTransactionsMenuButton();
    await suite.transactionPage.navigateToDrafts();

    const isContinueButtonVisible = await suite.transactionPage.isFirstDraftContinueButtonVisible();
    expect(isContinueButtonVisible).toBe(true);

    await suite.transactionPage.deleteFirstDraft();
  });
});
