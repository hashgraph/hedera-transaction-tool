import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerMnemonicHandlers from '@main/modules/ipcHandlers/localUser/mnemonic';

import { Prisma } from '@prisma/client';
import {
  addMnemonic,
  getMnemonics,
  updateMnemonic,
  removeMnemonics,
} from '@main/services/localUser/mnemonic';

vi.mock('@main/services/localUser/mnemonic', () => mockDeep());

describe('IPC handlers Mnemonics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerMnemonicHandlers();
  });

  const userId = 'userId';
  const mnemonicHash = 'mnemonicHash';
  const mnemonicHashes = ['mnemonicHash1', 'mnemonicHash2'];
  const nickname = 'nickname';

  test('Should register handlers for each event', () => {
    const events = ['add', 'get', 'update', 'remove'];
    expect(events.every(e => getIPCHandler(`mnemonic:${e}`))).toBe(true);
  });

  test('Should set up addMnemonic handler', async () => {
    await invokeIPCHandler('mnemonic:add', userId, mnemonicHash, nickname);
    expect(addMnemonic).toHaveBeenCalledWith(userId, mnemonicHash, nickname);
  });

  test('Should set up getMnemonics handler', async () => {
    const findArgs: Prisma.ClaimFindManyArgs = {
      where: { user_id: 'userId' },
    };

    await invokeIPCHandler('mnemonic:get', findArgs);

    expect(getMnemonics).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up updateMnemonic handler', async () => {
    await invokeIPCHandler('mnemonic:update', userId, mnemonicHash, nickname);
    expect(updateMnemonic).toHaveBeenCalledWith(userId, mnemonicHash, nickname);
  });

  test('Should set up removeMnemonics handler', async () => {
    await invokeIPCHandler('mnemonic:remove', userId, mnemonicHashes);
    expect(removeMnemonics).toHaveBeenCalledWith(userId, mnemonicHashes);
  });
});
