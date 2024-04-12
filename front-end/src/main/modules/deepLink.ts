import { BrowserWindow } from 'electron';

export const PROTOCOL_NAME = 'hedera-transaction-tool';

export default function (
  window: BrowserWindow,
  event: {
    preventDefault: () => void;
    readonly defaultPrevented: boolean;
  },
  url: string,
) {
  event.preventDefault();

  const params = url.split(`${PROTOCOL_NAME}://`)[1];

  if (params.includes('token')) {
    const token = params.split('token=')[1];
    window.webContents.send('deepLink:otp', token);
    window.show();
  }
}
