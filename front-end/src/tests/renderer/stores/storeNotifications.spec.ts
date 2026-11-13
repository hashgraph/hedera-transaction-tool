// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, reactive } from 'vue';

import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW } from '@shared/constants';
import { NotificationType } from '@shared/interfaces';

import useNotificationsStore from '@renderer/stores/storeNotifications';

const SERVER_URL = 'https://org.example';
const OTHER_SERVER_URL = 'https://other.example';

type WsHandler = (payload: unknown) => void;

const mocks = vi.hoisted(() => ({
  getAllInAppNotifications: vi.fn(),
  updateNotifications: vi.fn(),
  getUserNotificationPreferences: vi.fn(),
  updateUserNotificationPreferences: vi.fn(),
  getConnectionStatus: vi.fn(),
  // Fake websocket store: records handlers so tests can emit server events
  wsHandlers: new Map<string, WsHandler[]>(),
  wsDisposers: [] as ReturnType<typeof vi.fn>[],
  wsActionListener: null as null | ((ctx: unknown) => void),
  userStore: {
    personal: { isLoggedIn: true },
    organizations: [] as { serverUrl: string }[],
    selectedOrganization: null as null | Record<string, unknown>,
  },
  networkStore: { network: 'testnet' },
}));

vi.mock('@renderer/services/organization', () => ({
  getAllInAppNotifications: mocks.getAllInAppNotifications,
  updateNotifications: mocks.updateNotifications,
  getUserNotificationPreferences: mocks.getUserNotificationPreferences,
  updateUserNotificationPreferences: mocks.updateUserNotificationPreferences,
}));

vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: vi.fn((u: { isLoggedIn?: boolean } | null) => u?.isLoggedIn === true),
  isLoggedInOrganization: vi.fn(
    (o: { loggedIn?: boolean } | null) => o !== null && o?.loggedIn === true,
  ),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => mocks.networkStore),
}));

vi.mock('@renderer/stores/storeOrganizationConnection', () => ({
  default: vi.fn(() => ({ getConnectionStatus: mocks.getConnectionStatus })),
}));

vi.mock('@renderer/stores/storeWebsocketConnection', () => ({
  default: vi.fn(() => ({
    on: vi.fn((serverUrl: string, event: string, handler: WsHandler) => {
      const key = `${serverUrl}|${event}`;
      mocks.wsHandlers.set(key, [...(mocks.wsHandlers.get(key) ?? []), handler]);
      const dispose = vi.fn(() => {
        mocks.wsHandlers.set(
          key,
          (mocks.wsHandlers.get(key) ?? []).filter(h => h !== handler),
        );
      });
      mocks.wsDisposers.push(dispose);
      return dispose;
    }),
    $onAction: vi.fn((listener: (ctx: unknown) => void) => {
      mocks.wsActionListener = listener;
    }),
  })),
}));

/* Helpers */
const receiver = (
  id: number,
  type: NotificationType,
  network = 'testnet',
): Record<string, unknown> => ({
  id,
  notificationId: id * 10,
  isRead: false,
  notification: { id: id * 10, type, additionalData: { network } },
});

/** Simulates the websocket store finishing `setup()`, which is what (re)registers listeners */
const finishWebsocketSetup = () =>
  mocks.wsActionListener?.({ name: 'setup', after: (cb: () => void) => cb() });

/** Simulates the server emitting an event to this client */
const emit = (serverUrl: string, event: string, payload: unknown) => {
  for (const handler of mocks.wsHandlers.get(`${serverUrl}|${event}`) ?? []) handler(payload);
};

const flush = async () => {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
};

const createStore = async (initial: Record<string, unknown>[] = []) => {
  mocks.getAllInAppNotifications.mockResolvedValue(initial);
  const store = useNotificationsStore();
  await flush();
  finishWebsocketSetup();
  return store;
};

describe('storeNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());

    mocks.wsHandlers.clear();
    mocks.wsDisposers = [];
    mocks.wsActionListener = null;

    mocks.userStore = reactive({
      personal: { isLoggedIn: true },
      organizations: [{ serverUrl: SERVER_URL }],
      selectedOrganization: { serverUrl: SERVER_URL, userId: 1, loggedIn: true },
    });
    mocks.networkStore = reactive({ network: 'testnet' });

    mocks.getConnectionStatus.mockReturnValue('connected');
    mocks.getAllInAppNotifications.mockResolvedValue([]);
    mocks.updateNotifications.mockResolvedValue(undefined);
    mocks.getUserNotificationPreferences.mockResolvedValue([]);
  });

  describe('initial fetch', () => {
    test('loads in-app notifications for each connected organization', async () => {
      mocks.userStore.organizations = [{ serverUrl: SERVER_URL }, { serverUrl: OTHER_SERVER_URL }];
      mocks.getAllInAppNotifications.mockImplementation(async (url: string) =>
        url === SERVER_URL ? [receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)] : [],
      );

      const store = useNotificationsStore();
      await flush();

      expect(mocks.getAllInAppNotifications).toHaveBeenCalledWith(SERVER_URL, true);
      expect(mocks.getAllInAppNotifications).toHaveBeenCalledWith(OTHER_SERVER_URL, true);
      expect(store.notifications[SERVER_URL]).toHaveLength(1);
      expect(store.notifications[OTHER_SERVER_URL]).toEqual([]);
    });

    test('skips disconnected organizations', async () => {
      mocks.getConnectionStatus.mockReturnValue('disconnected');

      const store = useNotificationsStore();
      await flush();

      expect(mocks.getAllInAppNotifications).not.toHaveBeenCalled();
      expect(store.notifications).toEqual({});
    });

    test('keeps going when one organization fails to load', async () => {
      mocks.userStore.organizations = [{ serverUrl: SERVER_URL }, { serverUrl: OTHER_SERVER_URL }];
      mocks.getAllInAppNotifications.mockImplementation(async (url: string) => {
        if (url === SERVER_URL) throw new Error('boom');
        return [receiver(2, NotificationType.TRANSACTION_INDICATOR_REVIEW)];
      });

      const store = useNotificationsStore();
      await flush();

      expect(store.notifications[SERVER_URL]).toBeUndefined();
      expect(store.notifications[OTHER_SERVER_URL]).toHaveLength(1);
    });
  });

  describe('websocket: NOTIFICATIONS_NEW', () => {
    test('appends pushed notifications to the existing list for that server', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      emit(SERVER_URL, NOTIFICATIONS_NEW, [
        receiver(2, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(3, NotificationType.TRANSACTION_INDICATOR_REVIEW),
      ]);

      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([1, 2, 3]);
    });

    test('a pushed notification is reflected in the per-network indicator count', async () => {
      const store = await createStore();
      expect(store.networkNotifications.testnet).toBe(0);

      emit(SERVER_URL, NOTIFICATIONS_NEW, [
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN, 'testnet'),
      ]);

      expect(store.networkNotifications.testnet).toBe(1);
    });

    test('does not register listeners until the websocket store finishes setup', async () => {
      mocks.getAllInAppNotifications.mockResolvedValue([]);
      useNotificationsStore();
      await flush();

      expect(mocks.wsHandlers.get(`${SERVER_URL}|${NOTIFICATIONS_NEW}`)).toBeUndefined();

      finishWebsocketSetup();

      expect(mocks.wsHandlers.get(`${SERVER_URL}|${NOTIFICATIONS_NEW}`)).toHaveLength(1);
    });

    test('re-running setup replaces listeners instead of duplicating them', async () => {
      const store = await createStore();

      finishWebsocketSetup(); // e.g. websocket reconnect
      finishWebsocketSetup();

      emit(SERVER_URL, NOTIFICATIONS_NEW, [
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN),
      ]);

      // A leaked listener would append the same payload once per setup
      expect(store.notifications[SERVER_URL]).toHaveLength(1);
    });
  });

  describe('websocket: NOTIFICATIONS_INDICATORS_DELETE', () => {
    // The back-end gateway always wraps the payload in an array of
    // { notificationReceiverIds: number[] } (see fan-out.service.ts / websocket.gateway.ts).
    test('removes the listed receiver ids using the back-end wire format', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(3, NotificationType.TRANSACTION_INDICATOR_REVIEW),
      ]);

      emit(SERVER_URL, NOTIFICATIONS_INDICATORS_DELETE, [{ notificationReceiverIds: [1, 3] }]);

      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([2]);
    });

    test('merges several batched delete messages (gateway batches per user)', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(3, NotificationType.TRANSACTION_INDICATOR_SIGN),
      ]);

      emit(SERVER_URL, NOTIFICATIONS_INDICATORS_DELETE, [
        { notificationReceiverIds: [1] },
        { notificationReceiverIds: [2] },
      ]);

      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([3]);
    });

    test('ignores ids it does not have and entries missing the id list', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      emit(SERVER_URL, NOTIFICATIONS_INDICATORS_DELETE, [
        { notificationReceiverIds: [999] },
        {},
      ]);

      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([1]);
    });

    test('a status change (delete old indicator + push new one) swaps the tab indicator', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      // Back-end order: deletions and creations are emitted for the same status update
      emit(SERVER_URL, NOTIFICATIONS_INDICATORS_DELETE, [{ notificationReceiverIds: [1] }]);
      emit(SERVER_URL, NOTIFICATIONS_NEW, [
        receiver(2, NotificationType.TRANSACTION_INDICATOR_EXECUTABLE),
      ]);

      expect(store.notifications[SERVER_URL].map(n => n.notification.type)).toEqual([
        NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
      ]);
    });
  });

  describe('dismissNotifications', () => {
    test('removes only the given ids for the given server', async () => {
      mocks.userStore.organizations = [{ serverUrl: SERVER_URL }, { serverUrl: OTHER_SERVER_URL }];
      mocks.getAllInAppNotifications.mockResolvedValue([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_SIGN),
      ]);
      const store = useNotificationsStore();
      await flush();

      store.dismissNotifications(SERVER_URL, [1]);

      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([2]);
      expect(store.notifications[OTHER_SERVER_URL].map(n => n.id)).toEqual([1, 2]);
    });
  });

  describe('markAsRead', () => {
    test('PATCHes and dismisses only notifications of the given type', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_REVIEW),
        receiver(3, NotificationType.TRANSACTION_INDICATOR_SIGN),
      ]);

      await store.markAsRead(NotificationType.TRANSACTION_INDICATOR_SIGN);

      expect(mocks.updateNotifications).toHaveBeenCalledWith(SERVER_URL, [
        { id: 1, isRead: true },
        { id: 3, isRead: true },
      ]);
      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([2]);
    });

    test('leaves notifications from another network untouched', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN, 'testnet'),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_SIGN, 'mainnet'),
      ]);

      await store.markAsRead(NotificationType.TRANSACTION_INDICATOR_SIGN);

      expect(mocks.updateNotifications).toHaveBeenCalledWith(SERVER_URL, [{ id: 1, isRead: true }]);
      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([2]);
    });

    test('does not call the API when there is nothing of that type', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_REVIEW)]);

      await store.markAsRead(NotificationType.TRANSACTION_INDICATOR_SIGN);

      expect(mocks.updateNotifications).not.toHaveBeenCalled();
      expect(store.notifications[SERVER_URL]).toHaveLength(1);
    });

    test('keeps the notification when the API call fails', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);
      mocks.updateNotifications.mockRejectedValueOnce(new Error('nope'));

      await expect(store.markAsRead(NotificationType.TRANSACTION_INDICATOR_SIGN)).rejects.toThrow(
        'nope',
      );

      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([1]);
    });

    test('throws when no organization is selected', async () => {
      const store = await createStore();
      mocks.userStore.selectedOrganization = null;

      await expect(store.markAsRead(NotificationType.TRANSACTION_INDICATOR_SIGN)).rejects.toThrow(
        'No organization selected',
      );
    });
  });

  describe('markAsReadIds', () => {
    test('only sends ids the store actually holds', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      await store.markAsReadIds([1, 404]);

      expect(mocks.updateNotifications).toHaveBeenCalledWith(SERVER_URL, [{ id: 1, isRead: true }]);
      expect(store.notifications[SERVER_URL]).toEqual([]);
    });

    test('skips the API call when none of the ids are known', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      await store.markAsReadIds([404]);

      expect(mocks.updateNotifications).not.toHaveBeenCalled();
    });
  });

  describe('networkNotifications', () => {
    test('counts indicator notifications per network, bucketing unknown networks as custom', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN, 'testnet'),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_REVIEW, 'testnet'),
        receiver(3, NotificationType.TRANSACTION_INDICATOR_SIGN, 'mainnet'),
        receiver(4, NotificationType.TRANSACTION_INDICATOR_SIGN, 'https://my-mirror'),
      ]);

      expect(store.networkNotifications).toEqual({
        mainnet: 1,
        testnet: 2,
        previewnet: 0,
        'local-node': 0,
        custom: 1,
      });
    });

    test('does not count non-indicator notifications', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES, 'testnet'),
      ]);

      expect(store.networkNotifications.testnet).toBe(0);
    });
  });

  describe('currentOrganizationNotifications', () => {
    test('is scoped to the selected organization and active network', async () => {
      const store = await createStore([
        receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN, 'testnet'),
        receiver(2, NotificationType.TRANSACTION_INDICATOR_SIGN, 'mainnet'),
      ]);

      expect(store.currentOrganizationNotifications.map(n => n.id)).toEqual([1]);

      mocks.networkStore.network = 'mainnet';

      expect(store.currentOrganizationNotifications.map(n => n.id)).toEqual([2]);
    });

    test('is empty when logged out of the organization', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      mocks.userStore.selectedOrganization = null;

      expect(store.currentOrganizationNotifications).toEqual([]);
    });
  });

  describe('switching users within an organization', () => {
    test('refetches so stale receiver ids from the previous user are dropped', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);
      mocks.getAllInAppNotifications.mockClear();
      mocks.getAllInAppNotifications.mockResolvedValue([
        receiver(50, NotificationType.TRANSACTION_INDICATOR_REVIEW),
      ]);

      mocks.userStore.selectedOrganization = { serverUrl: SERVER_URL, userId: 2, loggedIn: true };
      await flush();

      expect(mocks.getAllInAppNotifications).toHaveBeenCalledTimes(1);
      expect(store.notifications[SERVER_URL].map(n => n.id)).toEqual([50]);
    });

    test('clears the list when the user logs out of the organization', async () => {
      const store = await createStore([receiver(1, NotificationType.TRANSACTION_INDICATOR_SIGN)]);

      mocks.userStore.selectedOrganization = null;
      await flush();

      expect(store.notifications[SERVER_URL]).toEqual([]);
    });
  });

  describe('preferences', () => {
    test('fetchPreferences maps email flags onto known notification types', async () => {
      mocks.getUserNotificationPreferences.mockResolvedValue([
        { type: NotificationType.TRANSACTION_CANCELLED, email: false },
        { type: 'SOMETHING_UNKNOWN', email: false },
      ]);

      const store = useNotificationsStore();
      await flush();

      expect(store.notificationsPreferences[NotificationType.TRANSACTION_CANCELLED]).toBe(false);
      expect(store.notificationsPreferences[NotificationType.TRANSACTION_EXECUTED]).toBe(true);
      expect(store.notificationsPreferences).not.toHaveProperty('SOMETHING_UNKNOWN');
    });

    test('updatePreferences stores the value returned by the API', async () => {
      const store = await createStore();
      mocks.updateUserNotificationPreferences.mockResolvedValue({
        type: NotificationType.TRANSACTION_EXPIRED,
        email: false,
      });

      await store.updatePreferences({
        type: NotificationType.TRANSACTION_EXPIRED,
        email: false,
      });

      expect(store.notificationsPreferences[NotificationType.TRANSACTION_EXPIRED]).toBe(false);
    });

    test('updatePreferences throws without a logged-in organization', async () => {
      const store = await createStore();
      mocks.userStore.selectedOrganization = null;

      await expect(store.updatePreferences({} as never)).rejects.toThrow(
        'No organization selected',
      );
    });
  });
});
