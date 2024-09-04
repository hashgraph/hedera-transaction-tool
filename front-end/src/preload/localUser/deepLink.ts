import { ipcRenderer } from 'electron';

export default {
  deepLink: {
    onOTPReceived: (callback: (otp: string) => void) => {
      const subscription = (_e: Electron.IpcRendererEvent, otp: string) => callback(otp);
      ipcRenderer.on('deepLink:otp', subscription);
      return () => {
        ipcRenderer.removeListener('deepLink:otp', subscription);
      };
    },
  },
};
