import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerClaimHandlers from '@main/modules/ipcHandlers/localUser/claim';

import { Prisma } from '@prisma/client';
import { addClaim, getClaims, removeClaims, updateClaim } from '@main/services/localUser/claim';
import { ipcMain } from 'electron';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser/claim', () => ({
  addClaim: vi.fn(),
  getClaims: vi.fn(),
  removeClaims: vi.fn(),
  updateClaim: vi.fn(),
}));

describe('IPC handlers Claims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerClaimHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = ['add', 'get', 'update', 'remove'];

    expect(
      events.every(e => ipcMainMO.handle.mock.calls.some(([channel]) => channel === `claim:${e}`)),
    ).toBe(true);
  });

  test('Should set up addClaim handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'claim:add');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const claimKey = 'claimKey';
    const claimValue = 'claimValue';

    handler && (await handler[1](event, userId, claimKey, claimValue));
    expect(addClaim).toHaveBeenCalledWith(userId, claimKey, claimValue);
  });

  test('Should set up getClaims handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'claim:get');
    expect(handler).toBeDefined();

    const findArgs: Prisma.ClaimFindManyArgs = {
      where: { user_id: 'userId' },
    };

    handler && (await handler[1](event, findArgs));
    expect(getClaims).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up updateClaim handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'claim:update');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const claimKey = 'claimKey';
    const claimValue = 'claimValue';

    handler && (await handler[1](event, userId, claimKey, claimValue));
    expect(updateClaim).toHaveBeenCalledWith(userId, claimKey, claimValue);
  });

  test('Should set up removeClaims handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'claim:remove');
    expect(handler).toBeDefined();

    const userId = 'userId';
    const claimKeys = ['claimKey1', 'claimKey2'];

    handler && (await handler[1](event, userId, claimKeys));
    expect(removeClaims).toHaveBeenCalledWith(userId, claimKeys);
  });
});
