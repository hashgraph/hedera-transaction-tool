import { ipcMain } from 'electron';

import registerPublicKeysLinkedHandlers from '@main/modules/ipcHandlers/localUser/publicKeyLinked';
import {
  createLinkedPublicKey,
  getLinkedPublicKeys,
  deleteLinkedPublicKey,
} from '@main/services/localUser';
import { Prisma } from '@prisma/client';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  createLinkedPublicKey: vi.fn(),
  getLinkedPublicKeys: vi.fn(),
  deleteLinkedPublicKey: vi.fn(),
}));

describe('IPC handlers organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPublicKeysLinkedHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const event = ['getLinkedPublicKeys', 'createLinkedPublicKey', 'deleteLinkedPublicKey'];

    expect(
      event.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `linkedPublicKeys:${util}`),
      ),
    ).toBe(true);
  });

  test('Should set up getLinkedPublicKeys handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'linkedPublicKeys:getLinkedPublicKeys',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';

    handler && (await handler[1](event, userId));
    expect(getLinkedPublicKeys).toHaveBeenCalledWith(userId);
  });

  test('Should set up createLinkedPublicKey handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'linkedPublicKeys:createLinkedPublicKey',
    );
    expect(handler).toBeDefined();

    const user_id = 'userId';
    const publicKey: Prisma.PublicKeyLinkedUncheckedCreateInput = {
      publicKey: 'publicKey',
      nickname: 'nickname',
      user_id: 'userId',
    };

    handler && (await handler[1](event, user_id, publicKey));
    expect(createLinkedPublicKey).toHaveBeenCalledWith(user_id, publicKey);
  });

  test('Should set up deleteLinkedPublicKey handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'linkedPublicKeys:deleteLinkedPublicKey',
    );
    expect(handler).toBeDefined();

    const id = 'publicKeyId';

    handler && (await handler[1](event, id));
    expect(deleteLinkedPublicKey).toHaveBeenCalledWith(id);
  });
});
