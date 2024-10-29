import { BrowserWindow } from 'electron';

export const checkForUpdate = async () => {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;

  const location = 'some-path';
  window.webContents.send('update:check-for-update-result', location);
};
