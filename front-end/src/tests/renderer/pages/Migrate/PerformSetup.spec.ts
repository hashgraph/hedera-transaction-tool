// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import PerformSetup from '@renderer/pages/Migrate/components/PerformSetup.vue';
import type { PersonalUser } from '@renderer/pages/Migrate/components/SetupPersonal.vue';
import type { ModelValue } from '@renderer/pages/Migrate/components/SetupOrganizationForm.vue';

const mocks = vi.hoisted(() => ({
  addOrganization: vi.fn(),
  changePassword: vi.fn(),
  getUserState: vi.fn(),
  addOrganizationCredentials: vi.fn(),
  updateOrganizationCredentials: vi.fn(),
  compareHash: vi.fn(),
  restorePrivateKey: vi.fn(),
  storeKeyPair: vi.fn(),
  safeDuplicateUploadKey: vi.fn(),
  processKeys: vi.fn(),
  user: {} as Record<string, any>,
}));

vi.mock('@renderer/services/organizationsService.ts', () => ({
  addOrganization: mocks.addOrganization,
}));
vi.mock('@renderer/services/organization', () => ({
  changePassword: mocks.changePassword,
  getUserState: mocks.getUserState,
}));
vi.mock('@renderer/services/organizationCredentials.ts', () => ({
  addOrganizationCredentials: mocks.addOrganizationCredentials,
  updateOrganizationCredentials: mocks.updateOrganizationCredentials,
}));
vi.mock('@renderer/services/electronUtilsService.ts', () => ({
  compareHash: mocks.compareHash,
}));
vi.mock('@renderer/services/keyPairService.ts', () => ({
  restorePrivateKey: mocks.restorePrivateKey,
  storeKeyPair: mocks.storeKeyPair,
}));
vi.mock('@renderer/stores/storeUser.ts', () => ({ default: () => mocks.user }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  safeDuplicateUploadKey: mocks.safeDuplicateUploadKey,
}));

const DecryptKeysStub = {
  props: ['defaultPassword'],
  emits: ['end'],
  setup(_: unknown, { expose }: { expose: (exposed: Record<string, unknown>) => void }) {
    expose({ process: mocks.processKeys });
  },
  template: '<div data-testid="decrypt-keys" />',
};

const RECOVERY_PHRASE = { words: ['inmate', 'modify', 'chronic'], hash: 'phrase-hash' };
const ORG_SETUP: ModelValue = {
  organizationURL: 'https://org.example.com',
  organizationEmail: 'user@example.com',
  organizationNickname: 'My Org',
  temporaryOrganizationPassword: 'tempPass123',
  newOrganizationPassword: 'newPass456',
};
const PASSWORD_USER: PersonalUser = {
  personalId: 'personal-id',
  useKeychain: false,
  email: 'user@example.com',
  password: 'personalPassword',
};
const KEYCHAIN_USER: PersonalUser = {
  personalId: 'personal-id',
  useKeychain: true,
  email: null,
  password: null,
};
const LOGGED_IN_ORG = {
  id: 'org-id',
  userId: 7,
  serverUrl: 'https://org.example.com',
  isLoading: false,
  isServerActive: true,
  loginRequired: false,
};

type Props = {
  personalUser: PersonalUser;
  organizationSetup: ModelValue | null;
  jwtToken: string | null;
  recoveryPhrase: typeof RECOVERY_PHRASE | null;
  recoveryPhrasePassword: string | null;
  selectedKeys: { fileName: string; filepath: string }[];
};

const mountStep = async (overrides: Partial<Props> = {}) => {
  const wrapper = mount(PerformSetup, {
    props: {
      personalUser: PASSWORD_USER,
      organizationSetup: null,
      jwtToken: null,
      recoveryPhrase: RECOVERY_PHRASE,
      recoveryPhrasePassword: 'test_password',
      selectedKeys: [],
      ...overrides,
    } as never,
    global: { stubs: { DecryptKeys: DecryptKeysStub } },
  });
  await flushPromises();
  return wrapper;
};

const finishKeyImport = async (wrapper: Awaited<ReturnType<typeof mountStep>>, count: number) => {
  wrapper.getComponent(DecryptKeysStub).vm.$emit('end', count);
  await flushPromises();
};

const realSetTimeout = globalThis.setTimeout;

describe('Migrate: perform setup step', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Skip the artificial 1.2s pause that avoids a flash effect
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, delay?: number) =>
      delay === 1200 ? (fn(), 0) : realSetTimeout(fn, delay)) as typeof setTimeout);

    Object.assign(mocks.user, {
      personal: { id: 'personal-id', isLoggedIn: true, useKeychain: false, password: 'personalPassword' },
      organizations: [{ id: 'org-id' }],
      selectedOrganization: LOGGED_IN_ORG,
      keyPairs: [],
      refetchOrganizations: vi.fn().mockResolvedValue(undefined),
      refetchUserState: vi.fn().mockResolvedValue(undefined),
      refetchKeys: vi.fn().mockResolvedValue(undefined),
      selectOrganization: vi.fn().mockResolvedValue(undefined),
    });
    mocks.addOrganization.mockResolvedValue({ id: 'org-id' });
    mocks.getUserState.mockResolvedValue({ userKeys: [] });
    mocks.restorePrivateKey.mockImplementation(async (_words, _pass, index: number) => ({
      publicKey: { toStringRaw: () => `public-key-${index}` },
      toStringRaw: () => `private-key-${index}`,
    }));
    mocks.compareHash.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('organization', () => {
    const orgProps = { organizationSetup: ORG_SETUP, jwtToken: 'jwt-token' };

    test('saves the organization and its credentials, sets the new password, and selects it', async () => {
      const calls: string[] = [];
      mocks.addOrganization.mockImplementation(async () => (calls.push('add'), { id: 'org-id' }));
      mocks.addOrganizationCredentials.mockImplementation(async () => void calls.push('credentials'));
      mocks.changePassword.mockImplementation(async () => void calls.push('changePassword'));
      mocks.updateOrganizationCredentials.mockImplementation(
        async () => void calls.push('updateCredentials'),
      );

      const wrapper = await mountStep(orgProps);

      expect(calls).toEqual(['add', 'credentials', 'changePassword', 'updateCredentials']);
      expect(mocks.addOrganization).toHaveBeenCalledWith({
        nickname: 'My Org',
        serverUrl: 'https://org.example.com',
        key: '',
      });
      expect(mocks.addOrganizationCredentials).toHaveBeenCalledWith(
        'user@example.com',
        'tempPass123',
        'org-id',
        'personal-id',
        'jwt-token',
        'personalPassword',
        false,
      );
      expect(mocks.changePassword).toHaveBeenCalledWith(
        'https://org.example.com',
        'tempPass123',
        'newPass456',
      );
      expect(mocks.updateOrganizationCredentials).toHaveBeenCalledWith(
        'org-id',
        'personal-id',
        undefined,
        'newPass456',
        undefined,
        'personalPassword',
      );
      expect(mocks.user.selectOrganization).toHaveBeenCalledWith({ id: 'org-id' });
      expect(wrapper.emitted('didPerformSetup')).toEqual([[0, null]]);
    });

    test('does not pass a personal password for a keychain user', async () => {
      await mountStep({ ...orgProps, personalUser: KEYCHAIN_USER });

      expect(mocks.addOrganizationCredentials).toHaveBeenCalledWith(
        'user@example.com',
        'tempPass123',
        'org-id',
        'personal-id',
        'jwt-token',
        null,
        false,
      );
      expect(mocks.updateOrganizationCredentials).toHaveBeenCalledWith(
        'org-id',
        'personal-id',
        undefined,
        'newPass456',
        undefined,
        undefined,
      );
    });

    test('a failure is reported to the wizard with the error and nothing is imported', async () => {
      const error = new Error('Password change rejected');
      mocks.changePassword.mockRejectedValue(error);

      const wrapper = await mountStep({
        ...orgProps,
        selectedKeys: [{ fileName: 'testkey1', filepath: '/Keys/testkey1.pem' }],
      });

      expect(wrapper.emitted('didPerformSetup')).toEqual([[0, error]]);
      expect(mocks.processKeys).not.toHaveBeenCalled();
    });
  });

  describe('skipped organization', () => {
    test('makes no organization requests and finishes with no keys imported', async () => {
      const wrapper = await mountStep();

      expect(mocks.addOrganization).not.toHaveBeenCalled();
      expect(mocks.changePassword).not.toHaveBeenCalled();
      expect(mocks.user.selectOrganization).not.toHaveBeenCalled();
      expect(wrapper.emitted('didPerformSetup')).toEqual([[0, null]]);
    });

    test('still imports the selected encrypted keys', async () => {
      mocks.user.selectedOrganization = null;
      mocks.processKeys.mockResolvedValue(undefined);

      const wrapper = await mountStep({
        selectedKeys: [{ fileName: 'testkey1', filepath: '/Keys/testkey1.pem' }],
      });
      await finishKeyImport(wrapper, 1);

      expect(wrapper.emitted('didPerformSetup')).toEqual([[1, null]]);
      expect(mocks.getUserState).not.toHaveBeenCalled();
    });
  });

  describe('encrypted key import', () => {
    const selectedKeys = [
      { fileName: 'testkey1', filepath: '/Keys/testkey1.pem' },
      { fileName: 'testkey2', filepath: '/Keys/testkey2.pem' },
    ];

    test('decrypts the selected key files using the recovery phrase and its password', async () => {
      const wrapper = await mountStep({ selectedKeys });

      expect(mocks.processKeys).toHaveBeenCalledWith(
        ['/Keys/testkey1.pem', '/Keys/testkey2.pem'],
        RECOVERY_PHRASE.words,
      );
      expect(wrapper.getComponent(DecryptKeysStub).props('defaultPassword')).toBe('test_password');
    });

    test('works without a recovery phrase', async () => {
      const wrapper = await mountStep({
        selectedKeys,
        recoveryPhrase: null,
        recoveryPhrasePassword: null,
      });

      expect(mocks.processKeys).toHaveBeenCalledWith(
        ['/Keys/testkey1.pem', '/Keys/testkey2.pem'],
        undefined,
      );
      expect(wrapper.getComponent(DecryptKeysStub).props('defaultPassword')).toBeUndefined();
    });

    test('reports the number of imported keys once decryption ends', async () => {
      const wrapper = await mountStep({ selectedKeys });

      expect(wrapper.emitted('didPerformSetup')).toBeUndefined();

      await finishKeyImport(wrapper, 2);

      expect(mocks.user.refetchUserState).toHaveBeenCalled();
      expect(wrapper.emitted('didPerformSetup')).toEqual([[2, null]]);
    });

    test('no key import is started when no keys were selected', async () => {
      await mountStep({ selectedKeys: [] });

      expect(mocks.processKeys).not.toHaveBeenCalled();
    });
  });

  describe('restoring organization keys from the recovery phrase', () => {
    const selectedKeys = [{ fileName: 'testkey1', filepath: '/Keys/testkey1.pem' }];
    const serverKey = (index: number) => ({
      id: index + 1,
      index,
      publicKey: `public-key-${index}`,
      mnemonicHash: `hash-${index}`,
    });

    const importKeys = async () => {
      const wrapper = await mountStep({ selectedKeys });
      await finishKeyImport(wrapper, 1);
      return wrapper;
    };

    test('restores a server key whose mnemonic hash matches the migrated phrase', async () => {
      mocks.getUserState.mockResolvedValue({ userKeys: [serverKey(3)] });

      await importKeys();

      expect(mocks.compareHash).toHaveBeenCalledWith('inmate,modify,chronic', 'hash-3');
      expect(mocks.restorePrivateKey).toHaveBeenCalledWith(RECOVERY_PHRASE.words, '', 3, 'ED25519');
      expect(mocks.storeKeyPair).toHaveBeenCalledWith(
        {
          user_id: 'personal-id',
          index: 3,
          public_key: 'public-key-3',
          private_key: 'private-key-3',
          type: 'ED25519',
          organization_id: 'org-id',
          organization_user_id: 7,
          secret_hash: 'phrase-hash',
          nickname: 'Restored Key 1',
        },
        'personalPassword',
        false,
      );
      expect(mocks.safeDuplicateUploadKey).not.toHaveBeenCalled();
    });

    test('restores keys without a password for a keychain user', async () => {
      mocks.user.personal = { id: 'personal-id', isLoggedIn: true, useKeychain: true, password: null };
      mocks.getUserState.mockResolvedValue({ userKeys: [serverKey(3)] });

      await importKeys();

      expect(mocks.storeKeyPair).toHaveBeenCalledWith(expect.anything(), null, false);
    });

    test('skips a key that is already stored locally', async () => {
      mocks.getUserState.mockResolvedValue({ userKeys: [serverKey(3)] });
      mocks.user.keyPairs = [{ public_key: 'public-key-3' }];

      await importKeys();

      expect(mocks.storeKeyPair).not.toHaveBeenCalled();
    });

    test('skips keys that belong to a different recovery phrase', async () => {
      mocks.getUserState.mockResolvedValue({ userKeys: [serverKey(3)] });
      mocks.compareHash.mockResolvedValue(false);

      await importKeys();

      expect(mocks.storeKeyPair).not.toHaveBeenCalled();
    });

    test('ignores server keys that have no mnemonic', async () => {
      mocks.getUserState.mockResolvedValue({
        userKeys: [{ id: 1, publicKey: 'external-key', mnemonicHash: null, index: null }],
      });

      await importKeys();

      expect(mocks.compareHash).not.toHaveBeenCalled();
    });

    test('restores several matching keys and names them in order', async () => {
      mocks.getUserState.mockResolvedValue({ userKeys: [serverKey(0), serverKey(1)] });

      await importKeys();

      const nicknames = mocks.storeKeyPair.mock.calls.map(call => call[0].nickname);
      expect(nicknames).toEqual(['Restored Key 1', 'Restored Key 2']);
    });

    test('when the account has no keys yet, uploads the first free key index', async () => {
      mocks.getUserState.mockResolvedValue({ userKeys: [] });
      mocks.safeDuplicateUploadKey
        .mockRejectedValueOnce(new Error('index 0 already used'))
        .mockRejectedValueOnce(new Error('index 1 already used'))
        .mockResolvedValueOnce(undefined);

      await importKeys();

      expect(mocks.safeDuplicateUploadKey).toHaveBeenCalledTimes(3);
      expect(mocks.safeDuplicateUploadKey).toHaveBeenLastCalledWith(LOGGED_IN_ORG, {
        publicKey: 'public-key-2',
        index: 2,
        mnemonicHash: 'phrase-hash',
      });
      expect(mocks.storeKeyPair).toHaveBeenCalledTimes(1);
      expect(mocks.storeKeyPair).toHaveBeenCalledWith(
        expect.objectContaining({ index: 2, nickname: 'Default' }),
        'personalPassword',
        false,
      );
    });

    test('restores nothing when there is no recovery phrase', async () => {
      const wrapper = await mountStep({ selectedKeys, recoveryPhrase: null });
      await finishKeyImport(wrapper, 1);

      expect(mocks.getUserState).not.toHaveBeenCalled();
      expect(mocks.storeKeyPair).not.toHaveBeenCalled();
    });
  });
});
