import { ipcMain } from 'electron';

import {
  addComplexKey,
  getComplexKeys,
  complexKeyExists,
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

  // Returns true if the complex key exists
  ipcMain.handle(
    createChannelName('complexKeyExists'),
    async (_e, userId: string, keyListBytes: Uint8Array) => complexKeyExists(userId, keyListBytes),
  );

  // Delete complex key
  ipcMain.handle(
    createChannelName('remove'),
    async (_e, userId: string, keyListBytes: Uint8Array) => removeComplexKey(userId, keyListBytes),
  );

  // Updates existing complex key
  ipcMain.handle(
    createChannelName('update'),
    async (_e, userId: string, oldKeyListBytes: Uint8Array, newKeyListBytes: Uint8Array) =>
      updateComplexKey(userId, oldKeyListBytes, newKeyListBytes),
  );
};
