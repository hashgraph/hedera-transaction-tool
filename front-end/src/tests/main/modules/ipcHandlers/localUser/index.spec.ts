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

vi.mock('@main/db/prisma', () => ({ getPath: vi.fn() }));

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/modules/ipcHandlers/localUser/keyPairs', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/accounts', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/transactions', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/files', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/transactionDrafts', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/complexKeys', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/organizations', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/organizationCredentials', () => ({
  default: vi.fn(),
}));
vi.mock('@main/modules/ipcHandlers/localUser/contacts', () => ({ default: vi.fn() }));
vi.mock('@main/modules/ipcHandlers/localUser/encryptedKeys', () => ({ default: vi.fn() }));

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
  });
});
