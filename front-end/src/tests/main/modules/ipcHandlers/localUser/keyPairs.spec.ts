import { ipcMain } from 'electron';
import { Prisma } from '@prisma/client';

import registerKeyPairsHandlers from '@main/modules/ipcHandlers/localUser/keyPairs';
import {
  storeKeyPair,
  deleteSecretHashes,
  changeDecryptionPassword,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
  getKeyPairs,
  getSecretHashes,
  deleteKeyPair,
  updateNickname,
  updateMnemonicHash,
} from '@main/services/localUser';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  storeKeyPair: vi.fn(),
  deleteSecretHashes: vi.fn(),
  changeDecryptionPassword: vi.fn(),
  decryptPrivateKey: vi.fn(),
  deleteEncryptedPrivateKeys: vi.fn(),
  getKeyPairs: vi.fn(),
  getSecretHashes: vi.fn(),
  deleteKeyPair: vi.fn(),
  updateNickname: vi.fn(),
  updateMnemonicHash: vi.fn(),
}));

describe('IPC handlers Key Pairs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerKeyPairsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = [
      'store',
      'changeDecryptionPassword',
      'decryptPrivateKey',
      'getAll',
      'getSecretHashes',
      'deleteEncryptedPrivateKeys',
      'clear',
      'updateNickname',
      'updateMnemonicHash',
    ];

    expect(
      events.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `keyPairs:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up store key pair handler', async () => {
    const storeHandler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:store');
    expect(storeHandler).toBeDefined();

    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      public_key: 'publicKey',
      private_key: 'privateKey',
      user_id: 'userId',
      type: 'type',
      index: 1,
    };
    const password = 'password';
    const encrypted = true;

    storeHandler && (await storeHandler[1](event, keyPair, password, encrypted));
    expect(storeKeyPair).toHaveBeenCalledWith(keyPair, password, encrypted);
  });

  test('Should set up changeDecryptionPassword handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'keyPairs:changeDecryptionPassword',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';
    const oldPassword = 'oldPassword';
    const newPassword = 'newPassword';

    handler && (await handler[1](event, userId, oldPassword, newPassword));
    expect(changeDecryptionPassword).toHaveBeenCalledWith(userId, oldPassword, newPassword);
  });

  test('Should set up decryptPrivateKey handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:decryptPrivateKey');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const password = 'password';
    const publicKey = 'publicKey';

    handler && (await handler[1](event, userId, password, publicKey));
    expect(decryptPrivateKey).toHaveBeenCalledWith(userId, password, publicKey);
  });

  test('Should set up getAll handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:getAll');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const organizationId = 'organizationId';

    handler && (await handler[1](event, userId, organizationId));
    expect(getKeyPairs).toHaveBeenCalledWith(userId, organizationId);
  });

  test('Should set up getSecretHashes handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:getSecretHashes');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const organizationId = 'organizationId';

    handler && (await handler[1](event, userId, organizationId));
    expect(getSecretHashes).toHaveBeenCalledWith(userId, organizationId);
  });

  test('Should set up deleteEncryptedPrivateKeys handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'keyPairs:deleteEncryptedPrivateKeys',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';
    const organizationId = 'organizationId';

    handler && (await handler[1](event, userId, organizationId));
    expect(deleteEncryptedPrivateKeys).toHaveBeenCalledWith(userId, organizationId);
  });

  test('Should set up deleteKeyPair handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:deleteKeyPair');
    expect(handler).toBeDefined();

    const keyPairId = 'keyPairId';

    handler && (await handler[1](event, keyPairId));
    expect(deleteKeyPair).toHaveBeenCalledWith(keyPairId);
  });

  test('Should set up clear handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:clear');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const organizationId = 'organizationId';

    if (!handler) return;

    await handler[1](event, userId, organizationId);
    expect(deleteSecretHashes).toHaveBeenCalledWith(userId, organizationId);

    vi.mocked(deleteSecretHashes).mockRejectedValueOnce(new Error('Error'));
    const result = await handler[1](event, userId, organizationId);
    expect(result).toBe(false);
  });

  test('Should set up updateNickname handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:updateNickname');
    expect(handler).toBeDefined();

    const keyPairId = 'keyPairId';
    const nickname = 'nickname';

    handler && (await handler[1](event, keyPairId, nickname));
    expect(updateNickname).toHaveBeenCalledWith(keyPairId, nickname);
  });

  test('Should set up updateMnemonicHash handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'keyPairs:updateMnemonicHash');
    expect(handler).toBeDefined();

    const keyPairId = 'keyPairId';
    const mnemonicHash = 'mnemonicHash';

    handler && (await handler[1](event, keyPairId, mnemonicHash));
    expect(updateMnemonicHash).toHaveBeenCalledWith(keyPairId, mnemonicHash);
  });
});
