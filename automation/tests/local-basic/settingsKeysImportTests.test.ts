import { expect, test } from '@playwright/test';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateECDSAKeyPair, generateEd25519KeyPair } from '../../utils/crypto/keyUtil.js';
import { setupSettingsKeysSuite } from '../helpers/fixtures/settingsKeysSuite.js';
import { fileURLToPath } from 'node:url';
import { clearDialogMockState, setDialogMockState } from '../../utils/runtime/dialogMocks.js';

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

  test('Verify user can import an encrypted private key', async () => {
    // Generate private key and encrypt it with a password
    const password = 'encrypted-key-password';
    const privateKey = crypto
      .createPrivateKey({
        key: Buffer.from(generateEd25519KeyPair().privateKey, 'hex'),
        type: 'pkcs8',
        format: 'der',
      })
      .export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: password });

    // Ensure the data directory exists
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dataDirectory = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDirectory)) {
      fs.mkdirSync(dataDirectory, { recursive: true });
    }

    // Write the file
    const fileName = `encrypted-import-${Date.now()}.pem`;
    const filePath = path.resolve(dataDirectory, fileName);
    fs.writeFileSync(filePath, privateKey);

    console.log(`Encrypted private key file generated at: ${filePath}`);

    try {
      await suite.settingsPage.clickOnKeysTab();
      await suite.settingsPage.clickOnImportButton();
      await suite.settingsPage.clickOnEncryptedKeysDropdown();

      // Browse opens Electron's native dialog through IPC, not a browser file chooser.
      await setDialogMockState(suite.window, { openPaths: [filePath] });
      await suite.settingsPage.clickOnBrowseEncryptedKeyButton();
      await suite.settingsPage.clickOnImportEncryptedKeyButton();

      await suite.settingsPage.clickOnSkipImportRecoveryPhraseButton();
      await suite.settingsPage.fillInDecryptKeysPassword(password);
      await suite.settingsPage.clickOnDecryptEncryptedKeyButton();

      await expect.poll(() => suite.settingsPage.getKeyRowCount()).toBe(2);
      await expect
        .poll(() => suite.registrationPage.getToastMessage())
        .toBe('Keys imported successfully');
    } finally {
      await clearDialogMockState(suite.window);
      fs.rmSync(filePath, { force: true });
    }
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
