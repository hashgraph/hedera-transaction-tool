import { mockDeep } from 'vitest-mock-extended';

import deepLink, { PROTOCOL_NAME } from '@main/modules/deepLink';

import { BrowserWindow } from 'electron';

describe('deepLink', () => {
  let window: BrowserWindow;
  let event: { preventDefault: () => void; readonly defaultPrevented: boolean };

  beforeEach(() => {
    window = mockDeep<BrowserWindow>({
      webContents: {
        send: vi.fn(),
      },
      show: vi.fn(),
    });
    event = {
      preventDefault: vi.fn(),
      defaultPrevented: false,
    };
  });

  test('Should prevent default event and send otp token if url contains token', () => {
    const token = 'testToken';
    const url = `${PROTOCOL_NAME}://token=${token}`;

    deepLink(window, event, url);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledWith('deepLink:otp', token);
    expect(window.show).toHaveBeenCalled();
  });

  test('Should prevent default event but not send otp token if url does not contain token', () => {
    const url = `${PROTOCOL_NAME}://`;

    deepLink(window, event, url);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.webContents.send).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
  });
});
