import path from 'path';
import fs from 'fs/promises';

import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron';

import { Key, KeyList } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { hash } from '@main/utils/crypto';
import { getNumberArrayFromString, saveContentToPath } from '@main/utils';

const createChannelName = (...props: string[]) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (_e, url: string) => shell.openExternal(url));

  ipcMain.handle(
    createChannelName('decodeProtobuffKey'),
    (_e, protobuffEncodedKey: string): Key | KeyList | proto.Key => {
      const buffer = Buffer.from(protobuffEncodedKey, 'hex');
      const key = proto.Key.decode(buffer);

      return key;
    },
  );

  ipcMain.handle(createChannelName('hash'), (_e, data): string => {
    const hashBuffer = hash(Buffer.from(data));

    const str = hashBuffer.toString('hex');

    return str;
  });

  ipcMain.handle(createChannelName('uint8ArrayToHex'), (_e, data: string): string => {
    return Buffer.from(getNumberArrayFromString(data)).toString('hex');
  });

  ipcMain.handle(createChannelName('hexToUint8Array'), (_e, hexString: string): string => {
    return Uint8Array.from(
      Buffer.from(hexString.startsWith('0x') ? hexString.slice(2) : hexString, 'hex'),
    ).toString();
  });

  ipcMain.handle(
    createChannelName('hexToUint8ArrayBatch'),
    (_e, hexStrings: string[]): string[] => {
      return hexStrings.map(hexString =>
        Uint8Array.from(
          Buffer.from(hexString.startsWith('0x') ? hexString.slice(2) : hexString, 'hex'),
        ).toString(),
      );
    },
  );

  ipcMain.handle(
    createChannelName('openBufferInTempFile'),
    async (_e, name: string, uint8ArrayString: string) => {
      const filePath = path.join(app.getPath('temp'), 'electronHederaFiles', `${name}.txt`);
      const content = Buffer.from(getNumberArrayFromString(uint8ArrayString));

      try {
        const saved = await saveContentToPath(filePath, content);

        if (saved) {
          shell.showItemInFolder(filePath);
          shell.openPath(filePath);
        }
      } catch (error) {
        console.log(error);
        throw new Error('Failed to open file content');
      }
    },
  );

  ipcMain.handle(createChannelName('saveFile'), async (_e, uint8ArrayString: string) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    const content = Buffer.from(getNumberArrayFromString(uint8ArrayString));

    try {
      const { filePath, canceled } = await dialog.showSaveDialog(windows[0], {
        defaultPath: app.getPath('documents'),
      });
      if (filePath === undefined || canceled) return;

      try {
        await fs.writeFile(filePath, content);
      } catch (error: any) {
        dialog.showErrorBox('Failed to save file', error?.message || 'Unknown error');
        console.log(error);
      }
    } catch (error: any) {
      dialog.showErrorBox('Failed to save file', error?.message || 'Unknown error');
    }
  });
};
