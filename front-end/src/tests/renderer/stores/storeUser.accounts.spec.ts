// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
  cache: { lookup: vi.fn() },
}));

vi.mock('@renderer/utils/logger', () => ({ createLogger: () => mocks.logger }));
vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: { inject: () => ({ mirrorAccountByPublicKey: mocks.cache }) },
}));
vi.mock('@renderer/stores/storeNetwork', () => ({
  default: () => ({ mirrorNodeBaseURL: 'https://mirror.test', network: 'testnet', setup: vi.fn() }),
}));
vi.mock('@renderer/stores/storeOrganizationConnection', () => ({ default: () => ({}) }));
vi.mock('@renderer/composables/user/useAfterOrganizationSelection', () => ({
  default: () => vi.fn(),
}));
vi.mock('@renderer/composables/useVersionCheck', () => ({
  default: () => ({ reset: vi.fn() }),
}));
vi.mock('@renderer/stores/versionState', () => ({
  getVersionStatusForOrg: vi.fn(),
  resetVersionStatusForOrg: vi.fn(),
}));
vi.mock('@renderer/services/claimService');
vi.mock('@renderer/services/organization', () => ({ reconnectOrganization: vi.fn() }));
vi.mock('@renderer/services/publicKeyMappingService');
vi.mock('@renderer/utils/userStoreHelpers');

import * as ush from '@renderer/utils/userStoreHelpers';
import useUserStore from '@renderer/stores/storeUser';

const accountOf = (account: string) => ({ account }) as never;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const pair = (public_key: string) => ({ public_key }) as never;
const newKeyPair = {
  user_id: 'user-1',
  public_key: 'pk-new',
  private_key: 'priv',
  type: 'ECDSA',
  index: -1,
} as never;

describe('storeUser - accounts of stored keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    vi.mocked(ush.storeKeyPair).mockResolvedValue(undefined);
    vi.mocked(ush.getLocalKeyPairs).mockResolvedValue([pair('pk-old'), pair('pk-new')]);
  });

  describe('storeKey', () => {
    test('stores the key and reloads the key list', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockResolvedValue([]);
      const user = useUserStore();

      await user.storeKey(newKeyPair, null, 'pw', false);

      expect(ush.storeKeyPair).toHaveBeenCalledWith(newKeyPair, null, 'pw', false);
      expect(user.keyPairs.map(k => k.public_key)).toEqual(['pk-old', 'pk-new']);
    });

    test('does not wait for the accounts of the new key', async () => {
      const lookup = deferred<never[]>();
      vi.mocked(ush.getPublicKeyToAccounts).mockReturnValue(lookup.promise);
      const user = useUserStore();

      await user.storeKey(newKeyPair, null, 'pw', false);

      // Resolved while the mirror node lookup is still pending
      expect(user.isLoadingAccountsOf('pk-new')).toBe(true);
      lookup.resolve([]);
    });

    test('only fetches the accounts of the new key', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockResolvedValue([]);
      const user = useUserStore();

      await user.storeKey(newKeyPair, null, 'pw', false);

      expect(ush.getPublicKeyToAccounts).toHaveBeenCalledTimes(1);
      expect(ush.getPublicKeyToAccounts).toHaveBeenCalledWith(
        [],
        [pair('pk-new')],
        'https://mirror.test',
        mocks.cache,
      );
    });

    test('marks only the new key as loading, then clears it and publishes its accounts', async () => {
      const lookup = deferred<unknown[]>();
      vi.mocked(ush.getPublicKeyToAccounts).mockReturnValue(lookup.promise as never);
      const user = useUserStore();

      await user.storeKey(newKeyPair, null, 'pw', false);
      expect(user.isLoadingAccountsOf('pk-new')).toBe(true);
      expect(user.isLoadingAccountsOf('pk-old')).toBe(false);

      lookup.resolve([{ publicKey: 'pk-new', accounts: [accountOf('0.0.5')] }]);
      await vi.waitFor(() => expect(user.isLoadingAccountsOf('pk-new')).toBe(false));

      expect(user.publicKeyToAccounts).toEqual([
        { publicKey: 'pk-new', accounts: [accountOf('0.0.5')] },
      ]);
    });

    test('logs, but does not throw, when the accounts of the new key cannot be fetched', async () => {
      const failure = new Error('mirror node down');
      vi.mocked(ush.getPublicKeyToAccounts).mockRejectedValue(failure);
      const user = useUserStore();

      await expect(user.storeKey(newKeyPair, null, 'pw', false)).resolves.toBeUndefined();

      await vi.waitFor(() =>
        expect(mocks.logger.error).toHaveBeenCalledWith(
          'Failed to refetch the accounts of the stored key',
          { publicKey: 'pk-new', error: failure },
        ),
      );
      expect(user.isLoadingAccountsOf('pk-new')).toBe(false);
    });

    test('does not log the private key', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockRejectedValue(new Error('down'));
      const user = useUserStore();

      await user.storeKey(newKeyPair, null, 'pw', false);
      await vi.waitFor(() => expect(mocks.logger.error).toHaveBeenCalled());

      expect(JSON.stringify(mocks.logger.error.mock.calls)).not.toContain('priv');
    });

    test('rejects, and fetches no accounts, when the key cannot be stored', async () => {
      vi.mocked(ush.storeKeyPair).mockRejectedValue(new Error('disk full'));
      const user = useUserStore();

      await expect(user.storeKey(newKeyPair, null, 'pw', false)).rejects.toThrow('disk full');
      expect(ush.getPublicKeyToAccounts).not.toHaveBeenCalled();
    });
  });

  describe('refetchAccounts for a single key', () => {
    test('keeps the accounts of the other keys', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockResolvedValue([
        { publicKey: 'pk-new', accounts: [accountOf('0.0.9')] },
      ]);
      const user = useUserStore();
      await user.refetchKeys();
      user.publicKeyToAccounts = [{ publicKey: 'pk-old', accounts: [accountOf('0.0.1')] }];

      await user.refetchAccounts('pk-new');

      expect(user.publicKeyToAccounts).toEqual([
        { publicKey: 'pk-old', accounts: [accountOf('0.0.1')] },
        { publicKey: 'pk-new', accounts: [accountOf('0.0.9')] },
      ]);
    });

    test('replaces an existing entry of that key instead of duplicating it', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockResolvedValue([
        { publicKey: 'pk-old', accounts: [accountOf('0.0.2')] },
      ]);
      const user = useUserStore();
      await user.refetchKeys();
      user.publicKeyToAccounts = [{ publicKey: 'pk-old', accounts: [accountOf('0.0.1')] }];

      await user.refetchAccounts('pk-old');

      expect(user.publicKeyToAccounts).toEqual([
        { publicKey: 'pk-old', accounts: [accountOf('0.0.2')] },
      ]);
    });

    test('drops the entry of a key that no longer has accounts', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockResolvedValue([]);
      const user = useUserStore();
      await user.refetchKeys();
      user.publicKeyToAccounts = [{ publicKey: 'pk-old', accounts: [accountOf('0.0.1')] }];

      await user.refetchAccounts('pk-old');

      expect(user.publicKeyToAccounts).toEqual([]);
    });

    test('is not loading once it fails, and rethrows', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockRejectedValue(new Error('boom'));
      const user = useUserStore();
      await user.refetchKeys();

      await expect(user.refetchAccounts('pk-new')).rejects.toThrow('boom');
      expect(user.isLoadingAccountsOf('pk-new')).toBe(false);
    });
  });

  describe('refetchAccounts for all keys', () => {
    test('clears the accounts and shows every key as loading until it finishes', async () => {
      const lookup = deferred<unknown[]>();
      vi.mocked(ush.getPublicKeyToAccounts).mockReturnValue(lookup.promise as never);
      const user = useUserStore();
      await user.refetchKeys();
      user.publicKeyToAccounts = [{ publicKey: 'pk-old', accounts: [accountOf('0.0.1')] }];

      const refetch = user.refetchAccounts();

      expect(user.publicKeyToAccounts).toEqual([]);
      expect(user.isLoadingAccountsOf('pk-old')).toBe(true);
      expect(user.isLoadingAccountsOf('pk-new')).toBe(true);

      lookup.resolve([{ publicKey: 'pk-old', accounts: [accountOf('0.0.1')] }]);
      await refetch;

      expect(user.isLoadingAccountsOf('pk-old')).toBe(false);
      expect(user.publicKeyToAccounts).toEqual([
        { publicKey: 'pk-old', accounts: [accountOf('0.0.1')] },
      ]);
    });

    test('looks up every stored key', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockResolvedValue([]);
      const user = useUserStore();
      await user.refetchKeys();

      await user.refetchAccounts();

      expect(ush.getPublicKeyToAccounts).toHaveBeenCalledWith(
        [],
        [pair('pk-old'), pair('pk-new')],
        'https://mirror.test',
        mocks.cache,
      );
    });

    test('an older, slower refetch cannot overwrite the result of a newer one', async () => {
      const first = deferred<unknown[]>();
      const second = deferred<unknown[]>();
      vi.mocked(ush.getPublicKeyToAccounts)
        .mockReturnValueOnce(first.promise as never)
        .mockReturnValueOnce(second.promise as never);
      const user = useUserStore();
      await user.refetchKeys();

      const olderRefetch = user.refetchAccounts();
      const newerRefetch = user.refetchAccounts();

      second.resolve([{ publicKey: 'pk-new', accounts: [accountOf('new')] }]);
      await newerRefetch;
      first.resolve([{ publicKey: 'pk-old', accounts: [accountOf('stale')] }]);
      await olderRefetch;

      expect(user.publicKeyToAccounts).toEqual([
        { publicKey: 'pk-new', accounts: [accountOf('new')] },
      ]);
      expect(user.isLoadingAccountsOf('pk-new')).toBe(false);
    });

    test('keeps showing loading while a newer refetch is still running', async () => {
      const first = deferred<unknown[]>();
      const second = deferred<unknown[]>();
      vi.mocked(ush.getPublicKeyToAccounts)
        .mockReturnValueOnce(first.promise as never)
        .mockReturnValueOnce(second.promise as never);
      const user = useUserStore();
      await user.refetchKeys();

      const olderRefetch = user.refetchAccounts();
      const newerRefetch = user.refetchAccounts();

      first.resolve([]);
      await olderRefetch;
      expect(user.isLoadingAccountsOf('pk-old')).toBe(true);

      second.resolve([]);
      await newerRefetch;
      expect(user.isLoadingAccountsOf('pk-old')).toBe(false);
    });

    test('stops loading when the lookup fails', async () => {
      vi.mocked(ush.getPublicKeyToAccounts).mockRejectedValue(new Error('boom'));
      const user = useUserStore();
      await user.refetchKeys();

      await expect(user.refetchAccounts()).rejects.toThrow('boom');
      expect(user.isLoadingAccountsOf('pk-old')).toBe(false);
    });
  });

  describe('isLoadingAccountsOf', () => {
    test('is false when nothing is being loaded', () => {
      expect(useUserStore().isLoadingAccountsOf('pk-old')).toBe(false);
    });
  });
});
