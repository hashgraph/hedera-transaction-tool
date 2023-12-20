import { ipcMain, shell } from 'electron';

import { Key, KeyList } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';
import { hash } from '../../utils/crypto';

const createChannelName = (...props) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (e, url: string) => shell.openExternal(url));

  ipcMain.handle(
    createChannelName('decodeProtobuffKey'),
    (e, protobuffEncodedKey: string): Key | KeyList | proto.Key => {
      const buffer = Buffer.from(protobuffEncodedKey, 'hex');
      const key = proto.Key.decode(buffer);

      return key;
    },
  );

  ipcMain.handle(createChannelName('hash'), (e, data: any): string => {
    const hashBuffer = hash(Buffer.from(data));

    const str = hashBuffer.toString('hex');

    return str;
  });
};
