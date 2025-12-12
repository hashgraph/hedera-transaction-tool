import { app, ipcMain } from 'electron';

const createChannelName = (...props: string[]) => ['update', ...props].join(':');

export default () => {
  ipcMain.handle(createChannelName('get-version'), () => app.getVersion());
};
