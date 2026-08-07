import { expect, test } from '@playwright/test';
import { PrivateKey } from '@hiero-ledger/sdk';
import {
  generateECDSAKeyPair,
  generateEd25519KeyPair,
  generateEncryptedPemFixture,
} from '../../utils/crypto/keyUtil.js';
import { insertLocalOrganization } from '../../utils/db/databaseQueries.js';
import { setDialogMockState } from '../../utils/runtime/dialogMocks.js';
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

  test('Verify user can import encrypted private key (3.2.15)', async () => {
    // Generate a fresh encrypted PEM on disk so no private-key material is
    // committed to the repository.  The fixture is removed after the test.
    const password = crypto.randomUUID();
    const { pemPath, cleanup } = await generateEncryptedPemFixture(password);
    try {
      // Pre-load the dialog mock so that clicking "Browse" returns our test PEM
      // instead of opening the native OS file picker.
      await setDialogMockState(suite.settingsPage.window, { openPaths: [pemPath] });

      await suite.settingsPage.clickOnKeysTab();
      await suite.settingsPage.clickOnImportButton();
      await suite.settingsPage.clickOnEncryptedKeysDropDown();

      const heading = await suite.settingsPage.getEncryptedKeysModalHeading();
      expect(heading).toBe('Import encrypted keys');

      // Click Browse — the IPC handler returns the mocked path, triggering the file
      // search which discovers the .pem fixture and populates the key list.
      await suite.settingsPage.clickBrowseForEncryptedKeys();

      // Wait for the Import button to become active (search complete, key selected).
      await suite.settingsPage.clickImportEncryptedKeysButton();

      // After Import is clicked the optional RecoveryPhraseModal appears first.
      // Skip it so the DecryptKeyModal can appear.
      await suite.settingsPage.skipRecoveryPhrase();

      // DecryptKeyModal appears — enter the generated password and submit.
      await suite.settingsPage.enterDecryptPassword(password);
      await suite.settingsPage.clickDecryptButton();

      const toastMessage = await suite.registrationPage.getToastMessage();
      expect(toastMessage).toBe('Keys imported successfully');
    } finally {
      await cleanup();
    }
  });

  test('Verify user can import external private key for missing key (3.2.18)', async () => {
    // Generate a fresh ED25519 key pair whose public key will be seeded as a "missing" key
    const newKey = PrivateKey.generateED25519();
    const newPublicKey = newKey.publicKey.toStringRaw();
    const newPrivateKey = newKey.toStringRaw();

    // Insert a real Organization row so the FK constraint on KeyPair.organization_id is
    // satisfied when the key is stored after the restore flow completes.
    const orgId = crypto.randomUUID();
    await insertLocalOrganization(orgId, 'Test Restore Org', 'http://localhost:19999', 'test-key');

    // Navigate to the Keys tab (Settings is already open from beforeEach)
    await suite.settingsPage.clickOnKeysTab();

    // Inject a fake connected-org state that includes the new public key as a userKey with
    // no corresponding local keyPair.  This makes the restore button visible for that row.
    await suite.settingsPage.injectFakeOrgWithUserKey(orgId, newPublicKey);

    // Wait for the restore button to become visible for the first row (the new key sorts
    // before the seeded key because it has only a userKey, not a keyPair).
    await suite.settingsPage.waitForElementToBeVisible('button-restore-key-0');

    // Click the restore button — this opens ImportExternalPrivateKeyModal with the public
    // key pre-filled.
    await suite.settingsPage.clickOnRestoreKeyButtonAtIndex(0);

    // Wait for the modal's private-key input to be ready, then clear the fake org
    // state so the import runs in local-only mode (no network call to the test server).
    await suite.settingsPage.waitForElementToBeVisible('input-ed25519-private-key');
    await suite.settingsPage.clearSelectedOrganization();

    // Enter the matching private key and a nickname, then submit.
    await suite.loginPage.waitForToastToDisappear();
    await suite.settingsPage.importED25519PrivateKey(newPrivateKey, 'Test-Missing-Key-Restore');

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('ED25519 private key imported successfully');
  });
});
