// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { io } from 'socket.io-client';
import { isUserLoggedIn } from '@renderer/utils';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

const mockOrgConnection = {
  getConnectionStatus: vi.fn(() => null as string | null),
  getDisconnectReason: vi.fn(() => null as string | null),
  setConnectionStatus: vi.fn(),
};

const mockUserStore = {
  personal: { id: 'user-1' },
  organizations: [{ id: 'org-1', serverUrl: 'https://test.server.com' }],
  getJwtToken: vi.fn(() => 'test-token'),
};

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mockUserStore) }));
vi.mock('@renderer/stores/storeOrganizationConnection', () => ({
  default: vi.fn(() => mockOrgConnection),
}));
vi.mock('@renderer/services/organizationsService', () => ({
  getLocalWebsocketPath: vi.fn((url: string) => url),
}));
vi.mock('@renderer/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
  isUserLoggedIn: vi.fn(() => true),
}));
vi.mock('@renderer/utils/version', () => ({ FRONTEND_VERSION: '1.0.0' }));

const SERVER_URL = 'https://test.server.com';

type MockSocket = {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
  active: boolean;
  id: string;
  trigger: (event: string, ...args: unknown[]) => void;
};

function createMockSocket(): MockSocket {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    active: true,
    id: 'mock-socket-id',
    trigger(event: string, ...args: unknown[]) {
      (handlers[event] ?? []).forEach(h => h(...args));
    },
  };
}

describe('useWebsocketConnection', () => {
  let store: ReturnType<typeof useWebsocketConnection>;
  let mockSocket: MockSocket;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Restore defaults that individual tests may override
    vi.mocked(isUserLoggedIn).mockReturnValue(true);

    mockSocket = createMockSocket();
    vi.mocked(io).mockReturnValue(mockSocket as any);

    mockOrgConnection.getConnectionStatus.mockReturnValue(null);
    mockOrgConnection.getDisconnectReason.mockReturnValue(null);

    store = useWebsocketConnection();
  });

  // ── Gap 1: connect event ────────────────────────────────────────────────────

  describe('listenConnection — connect event', () => {
    test('sets state to connected and calls setConnectionStatus with connected', () => {
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('connect');

      expect(store.isConnected(SERVER_URL)).toBe(true);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenCalledWith(SERVER_URL, 'connected');
    });
  });

  // ── existing disconnect tests + Gap 2 ───────────────────────────────────────

  describe('listenConnection — disconnect event', () => {
    test('does not broadcast a permanent disconnect when socket will auto-reconnect', () => {
      mockSocket.active = true;
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('disconnect', 'transport error');

      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );
    });

    test('sets state to disconnected and calls setConnectionStatus on permanent disconnect', () => {
      mockSocket.active = false;
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('disconnect', 'io server disconnect');

      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );
    });

    test('does not call setConnectionStatus when disconnect reason is upgradeRequired', () => {
      mockSocket.active = false;
      mockOrgConnection.getDisconnectReason.mockReturnValue('upgradeRequired');
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('disconnect', 'io server disconnect');

      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );
    });

    // Gap 2: compatibilityConflict branch
    test('does not call setConnectionStatus when disconnect reason is compatibilityConflict', () => {
      mockSocket.active = false;
      mockOrgConnection.getDisconnectReason.mockReturnValue('compatibilityConflict');
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('disconnect', 'io server disconnect');

      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );
    });
  });

  // ── existing connect_error tests + Gap 3 ────────────────────────────────────

  describe('listenConnection — connect_error event', () => {
    test('disconnects socket and sets upgradeRequired on version error', () => {
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('connect_error', new Error('Frontend version is required'));

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'upgradeRequired',
      );
    });

    test('does not call setConnectionStatus when socket will auto-reconnect', () => {
      mockSocket.active = true;
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('connect_error', new Error('Network error'));

      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalled();
    });

    test('sets state to disconnected when socket.active is false', () => {
      mockSocket.active = false;
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('connect_error', new Error('Connection refused'));

      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );
    });

    // Gap 3: guard — org already has 'disconnected' status → no duplicate call
    test('does not call setConnectionStatus when org status is already disconnected', () => {
      mockSocket.active = false;
      mockOrgConnection.getConnectionStatus.mockReturnValue('disconnected');
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('connect_error', new Error('Connection refused'));

      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalled();
    });
  });

  // ── existing isConnected tests ───────────────────────────────────────────────

  describe('isConnected', () => {
    test('returns true when state is connected', () => {
      store.connect(SERVER_URL, SERVER_URL);

      mockSocket.trigger('connect');

      expect(store.isConnected(SERVER_URL)).toBe(true);
    });

    test('returns false when state is connecting', () => {
      store.connect(SERVER_URL, SERVER_URL);

      // After connect() the state is 'connecting' — the 'connect' event has not fired yet
      expect(store.isConnected(SERVER_URL)).toBe(false);
    });
  });

  // ── Reconnection cycle (end-to-end) ─────────────────────────────────────────

  describe('reconnection cycle', () => {
    test('recovers to connected after a transient disconnect (socket.active=true)', () => {
      mockSocket.active = true;
      store.connect(SERVER_URL, SERVER_URL);

      // Initial connection
      mockSocket.trigger('connect');
      expect(store.isConnected(SERVER_URL)).toBe(true);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenCalledWith(SERVER_URL, 'connected');

      // Transient drop — socket.io will retry automatically
      mockSocket.trigger('disconnect', 'transport error');
      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );

      // socket.io reconnects and fires 'connect' again
      mockSocket.trigger('connect');
      expect(store.isConnected(SERVER_URL)).toBe(true);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenLastCalledWith(
        SERVER_URL,
        'connected',
      );
    });

    test('recovers to connected after a transient connect_error (socket.active=true)', () => {
      mockSocket.active = true;
      store.connect(SERVER_URL, SERVER_URL);

      // Initial connection
      mockSocket.trigger('connect');
      expect(store.isConnected(SERVER_URL)).toBe(true);

      // Transient error — socket.io will retry automatically
      mockSocket.trigger('connect_error', new Error('Network blip'));
      expect(store.isConnected(SERVER_URL)).toBe(false);
      expect(mockOrgConnection.setConnectionStatus).not.toHaveBeenCalledWith(
        SERVER_URL,
        'disconnected',
        'error',
      );

      // socket.io reconnects and fires 'connect' again
      mockSocket.trigger('connect');
      expect(store.isConnected(SERVER_URL)).toBe(true);
      expect(mockOrgConnection.setConnectionStatus).toHaveBeenLastCalledWith(
        SERVER_URL,
        'connected',
      );
    });
  });

  // ── Gap 4: store-level disconnect() action ──────────────────────────────────

  describe('disconnect (store action)', () => {
    test('calls off and disconnect on the socket and sets state to disconnected', async () => {
      await store.setup();

      store.disconnect(SERVER_URL);

      expect(mockSocket.off).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(store.isConnected(SERVER_URL)).toBe(false);
    });

    test('sets state to disconnected even when no socket exists for the url', () => {
      store.disconnect('https://no-socket.server.com');

      expect(store.isConnected('https://no-socket.server.com')).toBe(false);
    });
  });

  // ── Gap 5: setup() ──────────────────────────────────────────────────────────

  describe('setup', () => {
    test('skips all connections when user is not logged in', async () => {
      vi.mocked(isUserLoggedIn).mockReturnValue(false);

      await store.setup();

      expect(io).not.toHaveBeenCalled();
    });

    test('skips an organization whose connectionStatus is disconnected', async () => {
      mockOrgConnection.getConnectionStatus.mockReturnValue('disconnected');

      await store.setup();

      expect(io).not.toHaveBeenCalled();
    });

    test('opens a socket for each non-disconnected organization', async () => {
      await store.setup();

      expect(io).toHaveBeenCalledTimes(1);
    });

    test('calls setConnectionStatus connected when socket.connected is true at setup time', async () => {
      mockSocket.connected = true;

      await store.setup();

      expect(mockOrgConnection.setConnectionStatus).toHaveBeenCalledWith(SERVER_URL, 'connected');
    });
  });

  // ── Gap 6: on() subscription helper ────────────────────────────────────────

  describe('on', () => {
    test('forwards events from the socket to the callback', async () => {
      await store.setup();
      const callback = vi.fn();

      store.on(SERVER_URL, 'customEvent', callback);
      mockSocket.trigger('customEvent', 'payload');

      expect(callback).toHaveBeenCalledWith('payload');
    });

    test('cleanup function removes the event listener from the socket', async () => {
      await store.setup();
      const callback = vi.fn();

      const cleanup = store.on(SERVER_URL, 'customEvent', callback);
      cleanup();

      expect(mockSocket.off).toHaveBeenCalled();
    });

    test('returns a no-op cleanup when no socket exists for the serverUrl', () => {
      const callback = vi.fn();

      const cleanup = store.on('https://nonexistent.server.com', 'customEvent', callback);

      expect(() => cleanup()).not.toThrow();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── Gap 7: isLive() ─────────────────────────────────────────────────────────

  describe('isLive', () => {
    test('returns false when no socket exists for the serverUrl', () => {
      expect(store.isLive(SERVER_URL)).toBe(false);
    });

    test('returns true when the underlying socket.connected is true', async () => {
      await store.setup();
      mockSocket.connected = true;

      expect(store.isLive(SERVER_URL)).toBe(true);
    });

    test('returns false when the underlying socket.connected is false', async () => {
      await store.setup();
      mockSocket.connected = false;

      expect(store.isLive(SERVER_URL)).toBe(false);
    });
  });
});
