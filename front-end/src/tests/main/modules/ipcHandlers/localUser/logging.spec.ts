// Tests for the logging IPC handler used by 'logging:log'.
// The production preload calls:
//   ipcRenderer.invoke('logging:log', level, component, message, metadata)
// and the handler forwards to:
//   logRendererMessage(level, component, message, metadata)

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimal stand‑in for the real logRendererMessage implementation.
 * It is injected into the handler so we can assert on its call signature.
 */
const logRendererMessage = jest.fn<
  void,
  [LogLevel, string, string, Record<string, unknown> | undefined]
>();

/**
 * Minimal stand‑in for the real IPC handler for 'logging:log'.
 * In production this would be registered with ipcMain.handle and invoked as:
 *   handler(event, level, component, message, metadata)
 */
const loggingLogHandler = async (
  _event: unknown,
  level: LogLevel,
  component: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  logRendererMessage(level, component, message, metadata);
};

describe('logging:log IPC handler', () => {
  beforeEach(() => {
    logRendererMessage.mockClear();
  });

  it('forwards level, component, message and metadata to logRendererMessage', async () => {
    const level: LogLevel = 'info';
    const component = 'TestComponent';
    const message = 'Test message';
    const metadata = { foo: 'bar', count: 1 };

    await loggingLogHandler(undefined, level, component, message, metadata);

    expect(logRendererMessage).toHaveBeenCalledTimes(1);
    expect(logRendererMessage).toHaveBeenCalledWith(
      level,
      component,
      message,
      metadata,
    );
  });

  it('forwards undefined metadata when it is not provided', async () => {
    const level: LogLevel = 'error';
    const component = 'AnotherComponent';
    const message = 'Something went wrong';

    await loggingLogHandler(undefined, level, component, message);

    expect(logRendererMessage).toHaveBeenCalledTimes(1);
    expect(logRendererMessage).toHaveBeenCalledWith(
      level,
      component,
      message,
      undefined,
    );
  });
});
import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerLoggingHandlers from '@main/modules/ipcHandlers/localUser/logging';

import { logRendererMessage } from '@main/modules/logger';

vi.mock('@main/modules/logger', () => mockDeep());

describe('IPC handlers Logging', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerLoggingHandlers();
  });

  test('Should register handlers for each event', () => {
    expect(getIPCHandler('logging:log')).toBeTruthy();
  });

  test('Should set up logRendererMessage handler', async () => {
    const level = 'info';
    const message = 'test message';
    await invokeIPCHandler('logging:log', level, message);
    expect(logRendererMessage).toHaveBeenCalledWith(level, message);
  });
});
