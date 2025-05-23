import { mockDeep } from 'vitest-mock-extended';

import registerListeners from '@main/modules/ipcHandlers/localUser';
import listenForKeyPairEvents from '@main/modules/ipcHandlers/localUser/keyPairs';
import listenForAccountsEvents from '@main/modules/ipcHandlers/localUser/accounts';
import listenForTransactionsEvents from '@main/modules/ipcHandlers/localUser/transactions';
import listenForFilesEvents from '@main/modules/ipcHandlers/localUser/files';
import listenForTransactionDraftsEvents from '@main/modules/ipcHandlers/localUser/transactionDrafts';
import listenForComplexKeyEvents from '@main/modules/ipcHandlers/localUser/complexKeys';
import listenForOrganizationEvents from '@main/modules/ipcHandlers/localUser/organizations';
import listenForOrganizationCredentialsEvents from '@main/modules/ipcHandlers/localUser/organizationCredentials';
import listenForContactEvents from '@main/modules/ipcHandlers/localUser/contacts';
import listenForPublicEncryptedKeysEvents from '@main/modules/ipcHandlers/localUser/encryptedKeys';
import listenForPublicClaimEvents from '@main/modules/ipcHandlers/localUser/claim';
import listenForPublicMnemonicEvents from '@main/modules/ipcHandlers/localUser/mnemonic';
import listenForPublicKeyMappingsEvents from '@main/modules/ipcHandlers/localUser/publicKeyMappings';

vi.mock('@main/db/prisma', () => ({ getPath: vi.fn() }));

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/modules/ipcHandlers/localUser/keyPairs', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/accounts', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/transactions', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/files', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/transactionDrafts', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/complexKeys', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/organizations', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/organizationCredentials', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/contacts', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/encryptedKeys', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/claim', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/mnemonic', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser/publicKeyMappings', () => mockDeep());

describe('index', () => {
  test('should call all event listeners', () => {
    registerListeners();

    expect(listenForKeyPairEvents).toHaveBeenCalled();
    expect(listenForAccountsEvents).toHaveBeenCalled();
    expect(listenForTransactionsEvents).toHaveBeenCalled();
    expect(listenForFilesEvents).toHaveBeenCalled();
    expect(listenForTransactionDraftsEvents).toHaveBeenCalled();
    expect(listenForComplexKeyEvents).toHaveBeenCalled();
    expect(listenForOrganizationEvents).toHaveBeenCalled();
    expect(listenForOrganizationCredentialsEvents).toHaveBeenCalled();
    expect(listenForContactEvents).toHaveBeenCalled();
    expect(listenForPublicEncryptedKeysEvents).toHaveBeenCalled();
    expect(listenForPublicClaimEvents).toHaveBeenCalled();
    expect(listenForPublicMnemonicEvents).toHaveBeenCalled();
    expect(listenForPublicKeyMappingsEvents).toHaveBeenCalled();
  });
});
