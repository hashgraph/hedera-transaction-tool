import { expect, test } from '@playwright/test';
import { setupLocalTransactionSuite } from '../helpers/fixtures/localTransactionSuite.js';

test.describe('Transaction draft account persistence tests @local-transactions', () => {
  const suite = setupLocalTransactionSuite();

  test('Verify draft transaction contains the saved info for account create tx', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnCreateAccountTransaction();

    const transactionMemoText = 'test tx memo';
    const initialBalance = '10';
    const maxAutoAssociations = '10';
    const accountMemo = 'test acc memo';
    const testNickname = 'testNickname';
    await suite.transactionPage.fillInNickname(testNickname);
    await suite.transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await suite.transactionPage.clickOnReceiverSigRequiredSwitch();
    await suite.transactionPage.fillInInitialFunds(initialBalance);
    await suite.transactionPage.fillInMaxAccountAssociations(maxAutoAssociations);
    await suite.transactionPage.fillInMemo(accountMemo);

    await suite.transactionPage.saveDraft();

    await suite.transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await suite.transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const isAcceptStakingRewardsSwitchOn =
      await suite.transactionPage.isAcceptStakingRewardsSwitchToggledOn();
    expect(isAcceptStakingRewardsSwitchOn).toBe(true);

    const isReceiverSigRequiredSwitchOn =
      await suite.transactionPage.isReceiverSigRequiredSwitchToggledOn();
    expect(isReceiverSigRequiredSwitchOn).toBe(true);

    const initialFundsFromField = await suite.transactionPage.getInitialFundsValue();
    expect(initialFundsFromField).toBe(initialBalance);

    const maxAutoAssociationsFromField =
      await suite.transactionPage.getFilledMaxAccountAssociations();
    expect(maxAutoAssociationsFromField).toBe(maxAutoAssociations);

    const accountMemoFromField = await suite.transactionPage.getMemoText();
    expect(accountMemoFromField).toBe(accountMemo);

    await suite.transactionPage.navigateToDrafts();
    await suite.transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account update tx', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnUpdateAccountTransaction();

    const transactionMemoText = 'test tx memo';
    const accountIdToBeUpdated = '0.0.12345';
    const accountMemo = 'test acc memo';
    const maxAutoAssociations = '10';
    await suite.transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await suite.transactionPage.fillInUpdateAccountIdNormally(accountIdToBeUpdated);
    await suite.transactionPage.clickOnAcceptStakingRewardsSwitch();
    await suite.transactionPage.turnReceiverSigSwitchOn();
    await suite.transactionPage.fillInMaxAutoAssociations(maxAutoAssociations);
    await suite.transactionPage.fillInMemoUpdate(accountMemo);

    await suite.transactionPage.saveDraft();

    await suite.transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await suite.transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const isAcceptStakingRewardsSwitchOn =
      await suite.transactionPage.isAcceptStakingRewardsSwitchToggledOn();
    expect(isAcceptStakingRewardsSwitchOn).toBe(false);

    const isReceiverSigRequiredSwitchOn =
      await suite.transactionPage.isReceiverSigRequiredSwitchToggledOnForUpdatePage();
    expect(isReceiverSigRequiredSwitchOn).toBe(true);

    const maxAutoAssociationsFromField =
      await suite.transactionPage.getFilledMaxAutoAssociationsOnUpdatePage();
    expect(maxAutoAssociationsFromField).toBe(maxAutoAssociations);

    const accountMemoFromField = await suite.transactionPage.getMemoTextOnUpdatePage();
    expect(accountMemoFromField).toBe(accountMemo);

    await suite.transactionPage.navigateToDrafts();
    await suite.transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account delete tx', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnDeleteAccountTransaction();

    const transferAccountId = await suite.transactionPage.fillInTransferAccountId();
    const transactionMemoText = 'test memo';
    const accountIdToBeDeleted = '0.0.1234';
    await suite.transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await suite.transactionPage.fillInDeleteAccountIdNormally(accountIdToBeDeleted);

    await suite.transactionPage.saveDraft();
    await suite.transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await suite.transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const deletedIdFromField = await suite.transactionPage.getPrefilledAccountIdInDeletePage();
    expect(deletedIdFromField.startsWith(accountIdToBeDeleted)).toBe(true);

    const transferIdFromField =
      await suite.transactionPage.getPrefilledTransferIdAccountInDeletePage();
    expect(transferIdFromField).toContain(transferAccountId);

    await suite.transactionPage.navigateToDrafts();
    await suite.transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for approve allowance tx', async () => {
    await suite.transactionPage.clickOnCreateNewTransactionButton();
    await suite.transactionPage.clickOnApproveAllowanceTransaction();

    const transactionMemoText = 'test memo';
    const amount = '10';
    const spenderAccountId = '0.0.1234';
    await suite.transactionPage.fillInTransactionMemoForApprovePage(transactionMemoText);
    const ownerId = await suite.transactionPage.fillInAllowanceOwnerAccount();
    await suite.transactionPage.fillInAllowanceAmount(amount);
    await suite.transactionPage.fillInSpenderAccountIdNormally(spenderAccountId);

    await suite.transactionPage.saveDraft();
    await suite.transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField =
      await suite.transactionPage.getTransactionMemoFromApprovePage();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const allowanceOwnerAccountIdFromPage =
      await suite.transactionPage.getAllowanceOwnerAccountId();
    expect(allowanceOwnerAccountIdFromPage).toContain(ownerId);

    const allowanceAmountFromField = await suite.transactionPage.getAllowanceAmount();
    expect(allowanceAmountFromField).toBe(amount);

    const spenderAccountIdFromField = await suite.transactionPage.getSpenderAccountId();
    expect(spenderAccountIdFromField).toContain(spenderAccountId);

    await suite.transactionPage.navigateToDrafts();
    await suite.transactionPage.deleteFirstDraft();
  });
});
