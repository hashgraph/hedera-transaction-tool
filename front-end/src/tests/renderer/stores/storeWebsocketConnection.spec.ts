// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

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

import { io } from 'socket.io-client';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

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

  const socket: MockSocket = {
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

  return socket;
}

describe('useWebsocketConnection', () => {
  let store: ReturnType<typeof useWebsocketConnection>;
  let mockSocket: MockSocket;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    mockSocket = createMockSocket();
    vi.mocked(io).mockReturnValue(mockSocket as any);

    mockOrgConnection.getConnectionStatus.mockReturnValue(null);
    mockOrgConnection.getDisconnectReason.mockReturnValue(null);

    store = useWebsocketConnection();
  });

  describe('listenConnection — disconnect event', () => {
    test('sets state to connecting when socket.active is true (will auto-reconnect)', () => {
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
  });

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

    test('sets state to connecting when socket.active is true', () => {
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
  });

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
});
