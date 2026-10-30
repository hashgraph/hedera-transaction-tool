import type { FileFilter, OpenDialogReturnValue } from 'electron';
import { ipcRenderer } from 'electron';

export default {
  utils: {
    setDockBounce: (bounce: boolean) => ipcRenderer.send('utils:setDockBounce', bounce),
    openExternal: (url: string) => ipcRenderer.send('utils:openExternal', url),
    hash: (data: string, pseudoSalt: boolean = false): Promise<string> =>
      ipcRenderer.invoke('utils:hash', data, pseudoSalt),
    compareHash: (data: string, hash: string): Promise<boolean> =>
      ipcRenderer.invoke('utils:compareHash', data, hash),
    compareDataToHashes: (data: string, hashes: string[]): Promise<string | null> =>
      ipcRenderer.invoke('utils:compareDataToHashes', data, hashes),
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
    exportFilesWithDialog: (
      files: Array<{ data: Uint8Array | string; extension?: string }>,
      name: string,
      title: string,
      buttonLabel: string,
      filters: FileFilter[],
      message: string,
    ): Promise<boolean> =>
      ipcRenderer.invoke('utils:exportFilesWithDialog', files, name, title, buttonLabel, filters, message),
    setDialogMockState: (
      state: {
        savePath?: string | null;
        openPaths?: string[];
      },
    ): Promise<void> => ipcRenderer.invoke('utils:test:setDialogMockState', state),
    clearDialogMockState: (): Promise<void> =>
      ipcRenderer.invoke('utils:test:clearDialogMockState'),
    sha384: (str: string): Promise<string> => ipcRenderer.invoke('utils:sha384', str),
    x509BytesFromPem: (
      pem: string | Uint8Array,
    ): Promise<{ raw: Uint8Array; hash: string; text: string }> =>
      ipcRenderer.invoke('utils:x509BytesFromPem', pem),
    quit: (): Promise<void> => ipcRenderer.invoke('utils:quit'),
    relaunch: (): Promise<void> => ipcRenderer.invoke('utils:relaunch'),
  },
};
