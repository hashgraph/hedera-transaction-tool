import { ipcMain } from 'electron';

export const renameFunc = (func: (...args: any[]) => void, name: string) => {
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
    ipcMain.handle(createChannelName(name), (_e, ...args) => handler(...args));
  }
};
