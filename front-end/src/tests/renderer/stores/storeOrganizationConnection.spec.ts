// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => logger,
}));

const SERVER_URL = 'https://test.server.com';

describe('useOrganizationConnection', () => {
  let store: ReturnType<typeof useOrganizationConnection>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useOrganizationConnection();
  });

  describe('setConnectionStatus', () => {
    test('logs and updates status on an actual transition', () => {
      store.setConnectionStatus(SERVER_URL, 'connected');

      expect(store.getConnectionStatus(SERVER_URL)).toBe('connected');
      expect(logger.info).toHaveBeenCalledWith('Connection status updated', {
        serverUrl: SERVER_URL,
        status: 'connected',
      });
    });

    test('does not log again when the status is re-asserted unchanged', () => {
      store.setConnectionStatus(SERVER_URL, 'connected');
      logger.info.mockClear();

      store.setConnectionStatus(SERVER_URL, 'connected');

      expect(logger.info).not.toHaveBeenCalledWith(
        'Connection status updated',
        expect.anything(),
      );
    });

    test('logs again once the status actually changes', () => {
      store.setConnectionStatus(SERVER_URL, 'connected');
      logger.info.mockClear();

      store.setConnectionStatus(SERVER_URL, 'disconnected', 'error');

      expect(logger.info).toHaveBeenCalledWith('Connection status updated', {
        serverUrl: SERVER_URL,
        status: 'disconnected',
      });
    });

    test('clears the disconnect reason when status moves away from disconnected', () => {
      store.setConnectionStatus(SERVER_URL, 'disconnected', 'error');
      expect(store.getDisconnectReason(SERVER_URL)).toBe('error');

      store.setConnectionStatus(SERVER_URL, 'connected');

      expect(store.getDisconnectReason(SERVER_URL)).toBeNull();
    });
  });
});
