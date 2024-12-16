import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerClaimHandlers from '@main/modules/ipcHandlers/localUser/claim';

import { Prisma } from '@prisma/client';
import { addClaim, getClaims, removeClaims, updateClaim } from '@main/services/localUser/claim';

vi.mock('@main/services/localUser/claim', () => mockDeep());

describe('IPC handlers Claims', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerClaimHandlers();
  });

  const userId = 'userId';
  const claimKey = 'claimKey';
  const claimKeys = ['claimKey1', 'claimKey2'];
  const claimValue = 'claimValue';

  test('Should register handlers for each event', () => {
    const events = ['add', 'get', 'update', 'remove'];
    expect(events.every(e => getIPCHandler(`claim:${e}`))).toBe(true);
  });

  test('Should set up addClaim handler', async () => {
    await invokeIPCHandler('claim:add', userId, claimKey, claimValue);
    expect(addClaim).toHaveBeenCalledWith(userId, claimKey, claimValue);
  });

  test('Should set up getClaims handler', async () => {
    const findArgs: Prisma.ClaimFindManyArgs = {
      where: { user_id: 'userId' },
    };

    await invokeIPCHandler('claim:get', findArgs);

    expect(getClaims).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up updateClaim handler', async () => {
    await invokeIPCHandler('claim:update', userId, claimKey, claimValue);
    expect(updateClaim).toHaveBeenCalledWith(userId, claimKey, claimValue);
  });

  test('Should set up removeClaims handler', async () => {
    await invokeIPCHandler('claim:remove', userId, claimKeys);
    expect(removeClaims).toHaveBeenCalledWith(userId, claimKeys);
  });
});
