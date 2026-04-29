import { expect, test } from '@playwright/test';
import { setupSettingsKeysSuite } from '../helpers/fixtures/settingsKeysSuite.js';
import { restoreKeyFromSettings } from '../helpers/flows/settingsKeyRecoveryFlow.js';

test.describe('Settings keys basic action tests @local-basic', () => {
  const suite = setupSettingsKeysSuite();

  test('Verify user can decrypt private key', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnEyeDecryptIcon();
    const decryptedPrivateKey = await suite.settingsPage.getPrivateKeyText();
    expect(decryptedPrivateKey).toBeTruthy();
  });

  test('Verify user can copy public key to clipboard', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnCopyPublicKeyAtIndex(0);

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('Public Key copied successfully');

    // Assert toast auto-dismisses
    await suite.loginPage.waitForToastToDisappear();
    const isToastHidden = await suite.loginPage.isElementHidden(
      suite.registrationPage.visibleToastMessageSelector,
      0,
      suite.loginPage.getShortTimeout(),
    );
    expect(isToastHidden).toBe(true);
  });

  test('Verify user can copy private key to clipboard', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnEyeDecryptIcon();
    await suite.settingsPage.clickOnCopyPrivateKeyAtIndex(0);

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('Private Key copied successfully');
  });

  test('Verify user can restore key', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await restoreKeyFromSettings(suite.settingsPage, suite.registrationPage, suite.loginPage, {
      expectSuccessToast: true,
    });
    await suite.settingsPage.incrementIndex();
  });

  test('Verify user can delete key', async () => {
    await suite.settingsPage.clickOnKeysTab();
    const rowCountBeforeRestore = await suite.settingsPage.getKeyRowCount();

    await restoreKeyFromSettings(suite.settingsPage, suite.registrationPage, suite.loginPage, {
      expectSuccessToast: true,
    });
    await suite.settingsPage.incrementIndex();

    await suite.settingsPage.clickOnDeleteButtonAtIndex(rowCountBeforeRestore);
    await suite.settingsPage.clickOnDeleteKeyPairButton();
    await suite.loginPage.waitForToastToDisappear();

    const rowCountAfterDelete = await suite.settingsPage.getKeyRowCount();
    expect(rowCountBeforeRestore).toBe(rowCountAfterDelete);
    await suite.settingsPage.decrementIndex();
  });

  test('Verify user restored key pair is saved in the local database', async () => {
    await suite.settingsPage.clickOnKeysTab();

    const currentIndex = await restoreKeyFromSettings(
      suite.settingsPage,
      suite.registrationPage,
      suite.loginPage,
      {
        waitForToastAfterSave: true,
        waitForToastBeforeNickname: false,
      },
    );

    await expect
      .poll(
        async () =>
          await suite.settingsPage.verifyKeysExistByIndexAndEmail(
            suite.credentials.email,
            currentIndex,
          ),
        { timeout: 5000, intervals: [250] },
      )
      .toBe(true);

    await suite.settingsPage.incrementIndex();
  });
});
