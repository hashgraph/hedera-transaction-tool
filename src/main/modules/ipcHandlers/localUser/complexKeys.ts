import { ipcMain } from 'electron';

import {
  addComplexKey,
  getComplexKeys,
  getComplexKey,
  removeComplexKey,
  updateComplexKey,
} from '@main/services/localUser';

const createChannelName = (...props) => ['complexKeys', ...props].join(':');

export default () => {
  // Adds a new complex key
  ipcMain.handle(
    createChannelName('add'),
    async (_e, userId: string, keyListBytes: Uint8Array, nickname: string) =>
      addComplexKey(userId, keyListBytes, nickname),
  );

  // Get all stored complex keys
  ipcMain.handle(createChannelName('getAll'), async (_e, userId: string) => getComplexKeys(userId));

  // Returns particular complex key of a user
  ipcMain.handle(
    createChannelName('getComplexKey'),
    async (_e, userId: string, keyListBytes: Uint8Array) => getComplexKey(userId, keyListBytes),
  );

  // Delete complex key
  ipcMain.handle(
    createChannelName('remove'),
    async (_e, userId: string, keyListBytes: Uint8Array) => removeComplexKey(userId, keyListBytes),
  );

  // Updates existing complex key
  ipcMain.handle(createChannelName('update'), async (_e, id: string, newKeyListBytes: Uint8Array) =>
    updateComplexKey(id, newKeyListBytes),
  );
};
