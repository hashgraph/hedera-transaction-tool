import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

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
    async (_e, complexKey: Prisma.ComplexKeyUncheckedCreateInput) => addComplexKey(complexKey),
  );

  // Get all stored complex keys
  ipcMain.handle(createChannelName('getAll'), async (_e, userId: string) => getComplexKeys(userId));

  // Returns true if the complex key exists
  ipcMain.handle(
    createChannelName('complexKeyExists'),
    async (_e, userId: string, protobufEncoded: string) =>
      complexKeyExists(userId, protobufEncoded),
  );

  // Delete complex key
  ipcMain.handle(createChannelName('remove'), async (_e, userId: string, protobufEncoded: string) =>
    removeComplexKey(userId, protobufEncoded),
  );

  // Updates existing complex key
  ipcMain.handle(
    createChannelName('update'),
    async (_e, userId: string, oldProtobufEncoded: string, newProtobufEncoded: string) =>
      updateComplexKey(userId, oldProtobufEncoded, newProtobufEncoded),
  );
};
