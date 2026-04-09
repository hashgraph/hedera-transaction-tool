import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Transaction draft tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify user can save draft and is visible in the draft page', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.fillInDescription('test create tx description');
    await transactionPage.saveDraft();

    const draftDate = await transactionPage.getFirstDraftDate();
    expect(draftDate).toBeTruthy();

    const draftType = await transactionPage.getFirstDraftType();
    expect(draftType).toBe('Account Create');

    const description = await transactionPage.getFirstDraftDescription();
    expect(description).toBe('test create tx description');

    const isTemplateCheckboxVisible =
      await transactionPage.getFirstDraftIsTemplateCheckboxVisible();
    expect(isTemplateCheckboxVisible).toBe(true);

    const isDeleteButtonVisible = await transactionPage.isFirstDraftDeleteButtonVisible();
    expect(isDeleteButtonVisible).toBe(true);

    const isContinueButtonVisible = await transactionPage.isFirstDraftContinueButtonVisible();
    expect(isContinueButtonVisible).toBe(true);

    await transactionPage.deleteFirstDraft();
  });

  test('Verify user can delete a draft transaction', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.saveDraft();

    await transactionPage.deleteFirstDraft();

    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify draft transaction is no longer visible after we execute the tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.waitForPublicKeyToBeFilled();
    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftContinueButton();
    await transactionPage.createNewAccount({}, true);
    await transactionPage.clickOnTransactionsMenuButton();

    const isContinueButtonHidden = await transactionPage.isFirstDraftContinueButtonHidden();
    expect(isContinueButtonHidden).toBe(true);
  });

  test('Verify draft transaction is visible after we execute the tx and we have template checkbox selected', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.waitForPublicKeyToBeFilled();
    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftIsTemplateCheckbox();
    await transactionPage.clickOnFirstDraftContinueButton();
    await transactionPage.createNewAccount({}, true);
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.navigateToDrafts();

    const isContinueButtonVisible = await transactionPage.isFirstDraftContinueButtonVisible();
    expect(isContinueButtonVisible).toBe(true);

    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account create tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const transactionMemoText = 'test tx memo';
    const initialBalance = '10';
    const maxAutoAssociations = '10';
    const accountMemo = 'test acc memo';
    const testNickname = 'testNickname';
    await transactionPage.fillInNickname(testNickname);
    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.clickOnReceiverSigRequiredSwitch();
    await transactionPage.fillInInitialFunds(initialBalance);
    await transactionPage.fillInMaxAccountAssociations(maxAutoAssociations);
    await transactionPage.fillInMemo(accountMemo);

    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const isAcceptStakingRewardsSwitchOn =
      await transactionPage.isAcceptStakingRewardsSwitchToggledOn();
    expect(isAcceptStakingRewardsSwitchOn).toBe(true);

    const isReceiverSigRequiredSwitchOn =
      await transactionPage.isReceiverSigRequiredSwitchToggledOn();
    expect(isReceiverSigRequiredSwitchOn).toBe(true);

    const initialFundsFromField = await transactionPage.getInitialFundsValue();
    expect(initialFundsFromField).toBe(initialBalance);

    const maxAutoAssociationsFromField = await transactionPage.getFilledMaxAccountAssociations();
    expect(maxAutoAssociationsFromField).toBe(maxAutoAssociations);

    const accountMemoFromField = await transactionPage.getMemoText();
    expect(accountMemoFromField).toBe(accountMemo);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account update tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();

    const transactionMemoText = 'test tx memo';
    const accountIdToBeUpdated = '0.0.12345';
    const accountMemo = 'test acc memo';
    const maxAutoAssociations = '10';
    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInUpdateAccountIdNormally(accountIdToBeUpdated);
    await transactionPage.clickOnAcceptStakingRewardsSwitch();
    await transactionPage.turnReceiverSigSwitchOn();
    await transactionPage.fillInMaxAutoAssociations(maxAutoAssociations);
    await transactionPage.fillInMemoUpdate(accountMemo);

    await transactionPage.saveDraft();

    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const isAcceptStakingRewardsSwitchOn =
      await transactionPage.isAcceptStakingRewardsSwitchToggledOn();
    expect(isAcceptStakingRewardsSwitchOn).toBe(false);

    const isReceiverSigRequiredSwitchOn =
      await transactionPage.isReceiverSigRequiredSwitchToggledOnForUpdatePage();
    expect(isReceiverSigRequiredSwitchOn).toBe(true);

    const maxAutoAssociationsFromField =
      await transactionPage.getFilledMaxAutoAssociationsOnUpdatePage();
    expect(maxAutoAssociationsFromField).toBe(maxAutoAssociations);

    const accountMemoFromField = await transactionPage.getMemoTextOnUpdatePage();
    expect(accountMemoFromField).toBe(accountMemo);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for account delete tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnDeleteAccountTransaction();

    const transferAccountId = await transactionPage.fillInTransferAccountId();
    const transactionMemoText = 'test memo';
    const accountIdToBeDeleted = '0.0.1234';
    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInDeleteAccountIdNormally(accountIdToBeDeleted);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const deletedIdFromField = await transactionPage.getPrefilledAccountIdInDeletePage();
    expect(deletedIdFromField.startsWith(accountIdToBeDeleted)).toBe(true);

    const transferIdFromField = await transactionPage.getPrefilledTransferIdAccountInDeletePage();
    expect(transferIdFromField).toContain(transferAccountId);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for approve allowance tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnApproveAllowanceTransaction();

    const transactionMemoText = 'test memo';
    const amount = '10';
    const spenderAccountId = '0.0.1234';
    await transactionPage.fillInTransactionMemoForApprovePage(transactionMemoText);
    const ownerId = await transactionPage.fillInAllowanceOwnerAccount();
    await transactionPage.fillInAllowanceAmount(amount);
    await transactionPage.fillInSpenderAccountIdNormally(spenderAccountId);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoFromApprovePage();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const allowanceOwnerAccountIdFromPage = await transactionPage.getAllowanceOwnerAccountId();
    expect(allowanceOwnerAccountIdFromPage).toContain(ownerId);

    const allowanceAmountFromField = await transactionPage.getAllowanceAmount();
    expect(allowanceAmountFromField).toBe(amount);

    const spenderAccountIdFromField = await transactionPage.getSpenderAccountId();
    expect(spenderAccountIdFromField).toContain(spenderAccountId);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for create file tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnFileCreateTransaction();

    const transactionMemoText = 'test memo';
    const fileMemoText = 'file memo';
    // const fileContent = 'test file content';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileMemo(fileMemoText);
    // await transactionPage.fillInFileContent(fileContent);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileMemoFromField = await transactionPage.getFileMemoTextFromField();
    expect(fileMemoFromField).toBe(fileMemoText);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for update file tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnUpdateFileSublink();

    const transactionMemoText = 'test memo';
    const fileMemoText = 'file memo';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileIdForUpdate(fileId?? '');
    await transactionPage.fillInFileMemo(fileMemoText);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileIdFromPage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileId).toBe(fileIdFromPage);

    const fileMemoFromField = await transactionPage.getFileMemoTextFromField();
    expect(fileMemoFromField).toBe(fileMemoText);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for append file tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnAppendFileSublink();

    const transactionMemoText = 'test memo';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileIdForAppend(fileId?? '');

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileIdFromPage = await transactionPage.getFileIdFromAppendPage();
    expect(fileId).toBe(fileIdFromPage);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify that deleting all keys prevent to sign and execute a draft transaction', async () => {
    // This test is a copy of organizationSettingsTests.test.ts 'Verify that deleting all keys prevent to sign and execute a draft transaction'
    // If you fix something here, you probably want to do the same in organizationSettingsTests.test.ts

    // Go to Settings / Keys and delete all keys
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnSelectAllKeys();
    await settingsPage.clickOnDeleteKeyAllButton();
    await settingsPage.clickOnDeleteKeyPairButton();

    // Go to Transactions and fill a new Account Update transaction
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await transactionPage.fillInPayerAccountId('0.0.1002');
    await transactionPage.fillInMaxAutoAssociations('0'); // Workaround for -1 bug in maxAutoAssociations
    await transactionPage.fillInUpdatedAccountId('0.0.1002'); // Called last because it waits for sign and submit activation

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickOnSaveGotoSettings();
    await settingsPage.verifySettingsElements();

    // Go back to Transactions / Drafs
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnDraftsMenuButton();

    // Click Continue to edit draft transaction
    await transactionPage.clickOnFirstDraftContinueButton();

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await new Promise(resolve => setTimeout(resolve, 250));
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickOnGotoSettings();
    await settingsPage.verifySettingsElements();
  });
});
