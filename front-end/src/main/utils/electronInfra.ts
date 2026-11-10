import { ipcMain } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'node:url';

export const renameFunc = (func: (...args: any[]) => unknown | Promise<unknown>, name: string) => {
  const newFunc = (...args: any[]) => func(...args);
  Object.defineProperty(newFunc, 'name', { value: name });
  return newFunc;
};

export const createIPCChannel = (
  channelName: string,
  handlers: Array<(...args: any[]) => void>,
) => {
  const createChannelName = (...props) => [channelName, ...props].join(':');

  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i];
    const name = handler.name;
    if (!name) {
      throw new Error('IPC handler must have a name');
    }
    ipcMain.handle(createChannelName(name), (e, ...args) => {
      if (validateSenderFrame(e)) {
        return handler(...args);
      }
      throw new Error(`Unauthorized IPC sender: ${e.senderFrame?.url ?? 'null'}`);
    });
  }
};

export function validateSenderFrame(e: Electron.IpcMainInvokeEvent): boolean {
  const senderFrame = e.senderFrame;

  if (senderFrame === null || senderFrame !== e.sender.mainFrame) return false;

  const senderFrameURL = new URL(senderFrame.url);
  if (process.env.VITE_DEV_SERVER_URL) {
    const serverURL = new URL(process.env.VITE_DEV_SERVER_URL);
    if (serverURL.origin !== senderFrameURL.origin) return false;
  } else {
    const indexPath = join(process.env.DIST, 'index.html');
    const indexURL = pathToFileURL(indexPath);
    if (indexURL.href !== senderFrameURL.href) return false;
  }

  return true;
}
