import { expect, test } from '@playwright/test';
import { generateECDSAKeyPair, generateEd25519KeyPair } from '../../utils/crypto/keyUtil.js';
import { setupSettingsKeysSuite } from '../helpers/fixtures/settingsKeysSuite.js';

test.describe('Settings keys import tests @local-basic', () => {
  const suite = setupSettingsKeysSuite();

  test('Verify user can import ECDSA key', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnECDSADropDown();

    const privateKey = generateECDSAKeyPair();
    await suite.loginPage.waitForToastToDisappear();
    await suite.settingsPage.importECDSAPrivateKey(privateKey, 'Test-ECDSA-Import');

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('ECDSA private key imported successfully');

    const rowCount = await suite.settingsPage.getKeyRowCount();
    const lastRowIndex = rowCount - 1;
    const { index, nickname, accountID, keyType, publicKey } =
      await suite.settingsPage.getRowDataByIndex(lastRowIndex);

    expect(index).toBe('N/A');
    expect(nickname!.trim()).toBe('Test-ECDSA-Import');
    expect(accountID).toBeTruthy();
    expect(keyType).toBe('ECDSA');
    expect(publicKey).toBeTruthy();
  });

  test('Verify user can import ED25519 keys', async () => {
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();

    const { privateKey } = generateEd25519KeyPair();
    await suite.loginPage.waitForToastToDisappear();
    await suite.settingsPage.importED25519PrivateKey(privateKey, 'Test-ED25519-Import');

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('ED25519 private key imported successfully');

    const rowCount = await suite.settingsPage.getKeyRowCount();
    const lastRowIndex = rowCount - 1;
    const { index, nickname, accountID, keyType, publicKey } =
      await suite.settingsPage.getRowDataByIndex(lastRowIndex);

    expect(index).toBe('N/A');
    expect(nickname!.trim()).toBe('Test-ED25519-Import');
    expect(accountID).toBeTruthy();
    expect(keyType).toBe('ED25519');
    expect(publicKey).toBeTruthy();
  });

  test('Verify user can filter keys by All, Recovery Phrase, and Private Key', async () => {
    await suite.settingsPage.clickOnKeysTab();

    const { privateKey } = generateEd25519KeyPair();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();
    await suite.loginPage.waitForToastToDisappear();
    await suite.settingsPage.importED25519PrivateKey(privateKey, 'Filter-ED25519-Import');

    await suite.settingsPage.clickOnPrivateKeyFilterTab();
    const privateKeyRows = await suite.settingsPage.getKeyRowCount();
    expect(privateKeyRows).toBeGreaterThanOrEqual(1);

    const privateKeyData = await suite.settingsPage.getRowDataByIndex(0);
    expect(privateKeyData.index).toBe('N/A');

    await suite.settingsPage.selectFirstRecoveryPhraseFilterOption();
    const recoveryPhraseRows = await suite.settingsPage.getKeyRowCount();
    expect(recoveryPhraseRows).toBeGreaterThanOrEqual(1);

    await suite.settingsPage.clickOnAllKeysFilterTab();
    const allRows = await suite.settingsPage.getKeyRowCount();
    expect(allRows).toBeGreaterThan(privateKeyRows);
  });
});
