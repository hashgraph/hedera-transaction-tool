import { expect, test } from '@playwright/test';
import { generateEd25519KeyPair } from '../../utils/crypto/keyUtil.js';
import { setupSettingsKeysSuite } from '../helpers/fixtures/settingsKeysSuite.js';

test.describe('Settings keys management tests @local-basic', () => {
  const suite = setupSettingsKeysSuite();

  test('Verify user can select multiple keys and bulk delete', async () => {
    await suite.settingsPage.clickOnKeysTab();
    const initialRowCount = await suite.settingsPage.getKeyRowCount();

    const { privateKey: firstPrivateKey } = generateEd25519KeyPair();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();
    await suite.settingsPage.importED25519PrivateKey(firstPrivateKey, 'Bulk-Delete-ED25519-1');

    const { privateKey: secondPrivateKey } = generateEd25519KeyPair();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();
    await suite.settingsPage.importED25519PrivateKey(secondPrivateKey, 'Bulk-Delete-ED25519-2');
    await suite.loginPage.waitForToastToDisappear();

    const rowCountAfterImport = await suite.settingsPage.getKeyRowCount();
    expect(rowCountAfterImport).toBe(initialRowCount + 2);

    await suite.settingsPage.clickOnKeyCheckboxByIndex(rowCountAfterImport - 1);
    await suite.settingsPage.clickOnKeyCheckboxByIndex(rowCountAfterImport - 2);
    expect(await suite.settingsPage.isDeleteKeyAllButtonVisible()).toBe(true);

    await suite.settingsPage.clickOnDeleteKeyAllButton();
    await suite.settingsPage.clickOnDeleteKeyPairButton();

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('Private key(s) deleted successfully');

    await suite.loginPage.waitForToastToDisappear();
    expect(await suite.settingsPage.getKeyRowCount()).toBe(initialRowCount);
  });

  test('Verify duplicate private key import shows an error', async () => {
    await suite.settingsPage.clickOnKeysTab();

    const { privateKey } = generateEd25519KeyPair();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();
    await suite.settingsPage.importED25519PrivateKey(privateKey, 'Duplicate-Import-Key');
    await suite.loginPage.waitForToastToDisappear();

    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();
    await suite.settingsPage.importED25519PrivateKey(privateKey, 'Duplicate-Import-Key-Again', false);

    const toastMessage = await suite.registrationPage.getToastMessageByVariant('error');
    expect(toastMessage).toContain('Key pair already exists');
  });

  test('Verify user can change key nickname', async () => {
    const newNickname = 'testChangeNickname';
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.changeNicknameForFirstKey(newNickname);

    const keyData = await suite.settingsPage.getRowDataByIndex(0);
    expect(keyData.nickname!.trim()).toBe(newNickname);
  });

  test('Verify wrong app password blocks private key decryption', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clearCachedPersonalPasswordForTesting();

    await suite.settingsPage.clickOnEyeDecryptIcon();
    expect(await suite.settingsPage.isEncryptPasswordInputVisible()).toBe(true);

    await suite.settingsPage.fillInEncryptPassword('incorrect-password');
    await suite.settingsPage.clickOnContinueEncryptPasswordButton();
    await suite.settingsPage.wait(500);

    expect(await suite.settingsPage.isEncryptPasswordInputVisible()).toBe(true);
    expect(await suite.settingsPage.isPrivateKeyVisible()).toBe(false);
  });

  test('Verify decrypt private key flow is aborted when password modal is cancelled', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clearCachedPersonalPasswordForTesting();

    await suite.settingsPage.clickOnEyeDecryptIcon();
    expect(await suite.settingsPage.isEncryptPasswordInputVisible()).toBe(true);

    await suite.settingsPage.clickOnCancelEncryptPasswordButton();

    expect(await suite.settingsPage.isEncryptPasswordInputVisible()).toBe(false);
    expect(await suite.settingsPage.isPrivateKeyVisible()).toBe(false);
  });
});
