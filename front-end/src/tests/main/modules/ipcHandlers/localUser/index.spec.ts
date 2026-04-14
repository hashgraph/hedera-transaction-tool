import { mockDeep } from 'vitest-mock-extended';

import registerListeners from '@main/modules/ipcHandlers/localUser';
import listenForKeyPairEvents from '@main/modules/ipcHandlers/localUser/keyPairs';
import listenForLocalUserEvents from '@main/modules/ipcHandlers/localUser/localUser';
import listenForAccountsEvents from '@main/modules/ipcHandlers/localUser/accounts';
import listenForTransactionsEvents from '@main/modules/ipcHandlers/localUser/transactions';
import listenForFilesEvents from '@main/modules/ipcHandlers/localUser/files';
import listenForTransactionDraftsEvents from '@main/modules/ipcHandlers/localUser/transactionDrafts';
import listenForTransactionGroupsEvents from '@main/modules/ipcHandlers/localUser/transactionGroups';
import listenForComplexKeyEvents from '@main/modules/ipcHandlers/localUser/complexKeys';
import listenForOrganizationEvents from '@main/modules/ipcHandlers/localUser/organizations';
import listenForOrganizationCredentialsEvents from '@main/modules/ipcHandlers/localUser/organizationCredentials';
import listenForContactEvents from '@main/modules/ipcHandlers/localUser/contacts';
import listenForEncryptedKeysEvents from '@main/modules/ipcHandlers/localUser/encryptedKeys';
import listenForClaimEvents from '@main/modules/ipcHandlers/localUser/claim';
import listenForSafeStorageEvents from '@main/modules/ipcHandlers/localUser/safeStorage';
import listenForDataMigrationEvents from '@main/modules/ipcHandlers/localUser/dataMigration';
import listenForSDKEvents from '@main/modules/ipcHandlers/localUser/sdk';
import listenForMnemonicEvents from '@main/modules/ipcHandlers/localUser/mnemonic';
import listenForPublicKeyMappingsEvents from '@main/modules/ipcHandlers/localUser/publicKeyMappings';
import listenForImportV1Events from '@main/modules/ipcHandlers/localUser/importV1';
import listenForTransactionFileEvents from '@main/modules/ipcHandlers/localUser/transactionFile';
import listenForLoggingEvents from '@main/modules/ipcHandlers/localUser/logging';

vi.mock('@main/db/prisma', () => ({ getPath: vi.fn() }));

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/modules/ipcHandlers/localUser/keyPairs', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/localUser', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/accounts', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/transactions', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/files', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/transactionDrafts', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/transactionGroups', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/complexKeys', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/organizations', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/organizationCredentials', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/contacts', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/encryptedKeys', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/claim', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/safeStorage', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/dataMigration', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/sdk', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/mnemonic', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/publicKeyMappings', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/importV1', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/transactionFile', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/logging', () => mockDeep());

describe('index', () => {
  test('should call all event listeners', () => {
    registerListeners();

    expect(listenForKeyPairEvents).toHaveBeenCalledOnce();
    expect(listenForLocalUserEvents).toHaveBeenCalledOnce();
    expect(listenForAccountsEvents).toHaveBeenCalledOnce();
    expect(listenForTransactionsEvents).toHaveBeenCalledOnce();
    expect(listenForFilesEvents).toHaveBeenCalledOnce();
    expect(listenForTransactionDraftsEvents).toHaveBeenCalledOnce();
    expect(listenForTransactionGroupsEvents).toHaveBeenCalledOnce();
    expect(listenForComplexKeyEvents).toHaveBeenCalledOnce();
    expect(listenForOrganizationEvents).toHaveBeenCalledOnce();
    expect(listenForOrganizationCredentialsEvents).toHaveBeenCalledOnce();
    expect(listenForContactEvents).toHaveBeenCalledOnce();
    expect(listenForEncryptedKeysEvents).toHaveBeenCalledOnce();
    expect(listenForClaimEvents).toHaveBeenCalledOnce();
    expect(listenForSafeStorageEvents).toHaveBeenCalledOnce();
    expect(listenForDataMigrationEvents).toHaveBeenCalledOnce();
    expect(listenForSDKEvents).toHaveBeenCalledOnce();
    expect(listenForMnemonicEvents).toHaveBeenCalledOnce();
    expect(listenForPublicKeyMappingsEvents).toHaveBeenCalledOnce();
    expect(listenForImportV1Events).toHaveBeenCalledOnce();
    expect(listenForTransactionFileEvents).toHaveBeenCalledOnce();
    expect(listenForLoggingEvents).toHaveBeenCalledOnce();
  });
});
