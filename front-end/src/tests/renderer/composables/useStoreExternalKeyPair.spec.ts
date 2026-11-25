// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {
    personal: { id: 'user-1' },
    selectedOrganization: null as { id: string; userId: number } | null,
    keyPairs: [] as { public_key: string }[],
    storeKey: vi.fn(),
    refetchUserState: vi.fn(),
  },
  contactsFetch: vi.fn(),
  safeDuplicateUploadKey: vi.fn(),
  isLoggedInOrganization: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('@renderer/stores/storeContacts', () => ({
  default: () => ({ fetch: mocks.contactsFetch }),
}));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
  isLoggedInOrganization: mocks.isLoggedInOrganization,
  safeDuplicateUploadKey: mocks.safeDuplicateUploadKey,
}));

import useStoreExternalKeyPair from '@renderer/composables/useStoreExternalKeyPair';

const key = { public_key: 'pub-1', private_key: 'priv-1', nickname: 'nick', index: -1 };

describe('useStoreExternalKeyPair', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.keyPairs = [];
    mocks.user.selectedOrganization = null;
    mocks.isLoggedInOrganization.mockReturnValue(false);
    mocks.contactsFetch.mockResolvedValue(undefined);
  });

  test('stores the key without a recovery phrase hash and with the given type', async () => {
    await useStoreExternalKeyPair()(key, 'ECDSA', 'pw');

    expect(mocks.user.storeKey).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        public_key: 'pub-1',
        private_key: 'priv-1',
        nickname: 'nick',
        index: -1,
        type: 'ECDSA',
        organization_id: null,
        organization_user_id: null,
        secret_hash: null,
      },
      null,
      'pw',
      false,
    );
  });

  test('passes a null password through (keychain users)', async () => {
    await useStoreExternalKeyPair()(key, 'ED25519', null);

    expect(mocks.user.storeKey).toHaveBeenCalledWith(expect.anything(), null, null, false);
  });

  test('refetches the user state and the contacts after storing', async () => {
    await useStoreExternalKeyPair()(key, 'ED25519', 'pw');

    expect(mocks.user.refetchUserState).toHaveBeenCalledTimes(1);
    expect(mocks.contactsFetch).toHaveBeenCalledTimes(1);
  });

  test('does not fail when the contacts refetch fails', async () => {
    mocks.contactsFetch.mockRejectedValue(new Error('offline'));

    await expect(useStoreExternalKeyPair()(key, 'ED25519', 'pw')).resolves.toBeUndefined();
  });

  test('rejects a key that is already stored, without storing or uploading it', async () => {
    mocks.user.keyPairs = [{ public_key: 'pub-1' }];

    await expect(useStoreExternalKeyPair()(key, 'ED25519', 'pw')).rejects.toThrow(
      'Key pair already exists',
    );
    expect(mocks.user.storeKey).not.toHaveBeenCalled();
    expect(mocks.safeDuplicateUploadKey).not.toHaveBeenCalled();
  });

  test('does not upload anything outside an organization', async () => {
    await useStoreExternalKeyPair()(key, 'ED25519', 'pw');

    expect(mocks.safeDuplicateUploadKey).not.toHaveBeenCalled();
  });

  test('uploads the public key and scopes the key to the organization when in one', async () => {
    mocks.isLoggedInOrganization.mockReturnValue(true);
    mocks.user.selectedOrganization = { id: 'org-1', userId: 7 };

    await useStoreExternalKeyPair()(key, 'ECDSA', 'pw');

    expect(mocks.safeDuplicateUploadKey).toHaveBeenCalledWith(mocks.user.selectedOrganization, {
      publicKey: 'pub-1',
    });
    expect(mocks.user.storeKey).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: 'org-1', organization_user_id: 7 }),
      null,
      'pw',
      false,
    );
  });

  test('uploads before storing, so a failed upload leaves nothing stored', async () => {
    mocks.isLoggedInOrganization.mockReturnValue(true);
    mocks.user.selectedOrganization = { id: 'org-1', userId: 7 };
    mocks.safeDuplicateUploadKey.mockRejectedValue(new Error('upload failed'));

    await expect(useStoreExternalKeyPair()(key, 'ED25519', 'pw')).rejects.toThrow('upload failed');
    expect(mocks.user.storeKey).not.toHaveBeenCalled();
  });
});
