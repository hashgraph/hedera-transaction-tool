import { ipcMain, shell } from 'electron';

import { Key, KeyList } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { hash } from '@main/utils/crypto';

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
};
