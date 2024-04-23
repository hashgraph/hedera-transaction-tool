import { ipcRenderer } from 'electron';

import { proto } from '@hashgraph/proto';

export default {
  utils: {
    openExternal: (url: string) => ipcRenderer.send('utils:openExternal', url),
    decodeProtobuffKey: (protobuffEncodedKey: string): Promise<proto.Key> =>
      ipcRenderer.invoke('utils:decodeProtobuffKey', protobuffEncodedKey),
    hash: (data: any): Promise<string> => ipcRenderer.invoke('utils:hash', data),
    uint8ArrayToHex: (data: Uint8Array): Promise<string> =>
      ipcRenderer.invoke('utils:uint8ArrayToHex', data),
    hexToUint8Array: (hexString: string): Promise<string> =>
      ipcRenderer.invoke('utils:hexToUint8Array', hexString),
    hexToUint8ArrayBatch: (hexStrings: string[]): Promise<string[]> =>
      ipcRenderer.invoke('utils:hexToUint8ArrayBatch', hexStrings),
    openBufferInTempFile: (name: string, uint8ArrayString: string): Promise<void> =>
      ipcRenderer.invoke('utils:openBufferInTempFile', name, uint8ArrayString),
    saveFile: (uint8ArrayString: string): Promise<void> =>
      ipcRenderer.invoke('utils:saveFile', uint8ArrayString),
  },
};
