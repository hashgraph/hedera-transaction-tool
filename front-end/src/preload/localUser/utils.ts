import type { FileFilter, OpenDialogReturnValue } from 'electron';
import { ipcRenderer } from 'electron';

export default {
  utils: {
    openExternal: (url: string) => ipcRenderer.send('utils:openExternal', url),
    hash: (data: string): Promise<string> => ipcRenderer.invoke('utils:hash', data),
    compareHash: (data: string, hash: string): Promise<boolean> =>
      ipcRenderer.invoke('utils:compareHash', data, hash),
    compareDataToHashes: (data: string, hashes: string[]): Promise<string | null> =>
      ipcRenderer.invoke('utils:compareDataToHashes', data, hashes),
    openBufferInTempFile: (name: string, uint8ArrayString: string): Promise<void> =>
      ipcRenderer.invoke('utils:openBufferInTempFile', name, uint8ArrayString),
    saveFile: (uint8ArrayString: string): Promise<void> =>
      ipcRenderer.invoke('utils:saveFile', uint8ArrayString),
    showOpenDialog: (
      title: string,
      buttonLabel: string,
      filters: FileFilter[],
      properties: ('openFile' | 'openDirectory' | 'multiSelections')[],
      message: string,
    ): Promise<OpenDialogReturnValue> =>
      ipcRenderer.invoke('utils:showOpenDialog', title, buttonLabel, filters, properties, message),
    quit: (): Promise<void> => ipcRenderer.invoke('utils:quit'),
  },
};
