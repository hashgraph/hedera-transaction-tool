import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';

import { NotificationType } from '@shared/interfaces';

import { useGroupedNotifications } from '@renderer/components/Notifications/composables/useGroupedNotifications';

const serverUrl = 'https://org.example';

const mockUser: any = { organizations: [], selectedOrganization: { serverUrl }, selectOrganization: vi.fn() };
const mockNetwork = {
  network: 'mainnet',
  setNetwork: vi.fn(),
  isCurrentNetwork: vi.fn((n: string) => n === mockNetwork.network),
  normalizeCustomMirrorNodeURL: vi.fn((n: string) => {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(n) ? n : `https://${n}`);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid');
    return url.toString().replace(/\/$/, '');
  }),
};
const mockNotifications = reactive<{ notifications: Record<string, unknown[]>; markAsRead: any }>({
  notifications: {},
  markAsRead: vi.fn(),
});

const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mockRouterPush }) }));
vi.mock('@renderer/stores/storeUser', () => ({ default: () => mockUser }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => mockNetwork }));
vi.mock('@renderer/stores/storeNotifications', () => ({ default: () => mockNotifications }));

const setup = (network: string) => {
  mockNotifications.notifications = {
    [serverUrl]: [
      {
        isRead: false,
        notification: {
          type: NotificationType.TRANSACTION_INDICATOR_SIGN,
          additionalData: { network },
        },
      },
    ],
  };
  const composable = useGroupedNotifications();
  const click = () => composable.groupedNotifications.value[serverUrl][network][0].action();
  return { ...composable, click };
};

describe('useGroupedNotifications network switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNetwork.network = 'mainnet';
  });

  it('switches to a built-in network without prompting', async () => {
    const { click, pendingNetworkHost } = setup('testnet');
    await click();
    expect(pendingNetworkHost.value).toBeNull();
    expect(mockNetwork.setNetwork).toHaveBeenCalledWith('testnet');
  });

  it('asks for confirmation before switching to a custom host', async () => {
    const { click, pendingNetworkHost, confirmNetwork } = setup('mirror.example.com');
    const pending = click();
    await Promise.resolve();
    expect(pendingNetworkHost.value).toBe('mirror.example.com');
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
    confirmNetwork();
    await pending;
    expect(mockNetwork.setNetwork).toHaveBeenCalledWith('mirror.example.com');
    expect(pendingNetworkHost.value).toBeNull();
  });

  it('does not switch or navigate when the user cancels', async () => {
    const { click, cancelNetwork } = setup('mirror.example.com');
    const pending = click();
    await Promise.resolve();
    cancelNetwork();
    await pending;
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('does not prompt when already on that custom network', async () => {
    mockNetwork.network = 'mirror.example.com';
    const { click, pendingNetworkHost } = setup('mirror.example.com');
    await click();
    expect(pendingNetworkHost.value).toBeNull();
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('refuses malformed hosts without prompting', async () => {
    const { click, pendingNetworkHost } = setup('evil.com/path?x=1');
    await click();
    expect(pendingNetworkHost.value).toBeNull();
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('navigates without switching or prompting when the notification has no network', async () => {
    mockNotifications.notifications = {
      [serverUrl]: [
        {
          isRead: false,
          notification: { type: NotificationType.TRANSACTION_INDICATOR_SIGN },
        },
      ],
    };
    const composable = useGroupedNotifications();
    await composable.groupedNotifications.value[serverUrl]['Unknown'][0].action();
    expect(composable.pendingNetworkHost.value).toBeNull();
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalled();
  });

  it('selects the notification organization even when the network switch is declined', async () => {
    mockUser.selectedOrganization = { serverUrl: 'https://other.example' };
    mockUser.organizations = [{ serverUrl }] as any;
    const { click, cancelNetwork } = setup('mirror.example.com');
    const pending = click();
    await Promise.resolve();
    cancelNetwork();
    await pending;
    expect(mockUser.selectOrganization).toHaveBeenCalled();
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
  });

  it.each([
    [NotificationType.TRANSACTION_INDICATOR_EXECUTABLE],
    [NotificationType.TRANSACTION_INDICATOR_SIGN],
    [NotificationType.TRANSACTION_INDICATOR_EXECUTED],
    [NotificationType.USER_REGISTERED],
  ])('never navigates for %s when a custom network is declined', async type => {
    mockNotifications.notifications = {
      [serverUrl]: [
        { isRead: false, notification: { type, additionalData: { network: 'mirror.example.com' } } },
      ],
    };
    const composable = useGroupedNotifications();
    const pending = composable.groupedNotifications.value[serverUrl]['mirror.example.com'][0].action();
    await Promise.resolve();
    composable.cancelNetwork();
    await pending;
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
  });

  it('does not mark approval notifications read when a custom network is declined', async () => {
    mockNotifications.notifications = {
      [serverUrl]: [
        {
          isRead: false,
          notification: {
            type: NotificationType.TRANSACTION_APPROVED,
            additionalData: { network: 'mirror.example.com' },
          },
        },
      ],
    };
    const composable = useGroupedNotifications();
    const pending = composable.groupedNotifications.value[serverUrl]['mirror.example.com'][0].action();
    await Promise.resolve();
    composable.cancelNetwork();
    await pending;
    expect(mockNotifications.markAsRead).not.toHaveBeenCalled();
  });

  it.each(['http://mirror.example.com', 'user:pw@mirror.example.com', 'mirror.example.com#x'])(
    'refuses %s',
    async host => {
      const { click, pendingNetworkHost } = setup(host);
      await click();
      expect(pendingNetworkHost.value).toBeNull();
      expect(mockNetwork.setNetwork).not.toHaveBeenCalled();
    },
  );
});
