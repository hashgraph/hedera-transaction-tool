// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import Migrate from '@renderer/pages/Migrate/Migrate.vue';
import { ToastManager } from '@renderer/utils/ToastManager';

const mocks = vi.hoisted(() => ({
  user: {
    login: vi.fn(),
    logout: vi.fn(),
    setPassword: vi.fn(),
    setRecoveryPhrase: vi.fn(),
    setAccountSetupStarted: vi.fn(),
  },
  accountSetup: { storeSkipRecoveryPhraseClaim: vi.fn() },
  router: { push: vi.fn() },
  resetDataLocal: vi.fn(),
  getStaticUser: vi.fn(),
  getDataMigrationKeysPath: vi.fn(),
  searchEncryptedKeys: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRouter: () => mocks.router }));
vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('@renderer/stores/storeAccountSetup', () => ({ default: () => mocks.accountSetup }));
vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  DEFAULT_LAYOUT: 'default',
}));
vi.mock('@renderer/services/userService', () => ({ resetDataLocal: mocks.resetDataLocal }));
vi.mock('@renderer/services/safeStorageService', () => ({
  getStaticUser: mocks.getStaticUser,
}));
vi.mock('@renderer/services/migrateDataService', () => ({
  getDataMigrationKeysPath: mocks.getDataMigrationKeysPath,
}));
vi.mock('@renderer/services/encryptedKeys', () => ({
  searchEncryptedKeys: mocks.searchEncryptedKeys,
}));
vi.mock('@renderer/utils', () => ({
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

/* Step stubs: render a marker, expose their props, and let tests emit the step events */
const step = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    props: {
      personalUser: Object,
      recoveryPhrase: Object,
      organizationSetup: Object,
      jwtToken: String,
      recoveryPhrasePassword: String,
      selectedKeys: Array,
      keysToRecover: Array,
      importedKeysCount: Number,
      importedUserData: Object,
    },
    render: () => h('div', { 'data-step': name }),
  });

const Stubs = {
  DecryptRecoveryPhrase: step('DecryptRecoveryPhrase'),
  SetupPersonal: step('SetupPersonal'),
  SetupOrganization: step('SetupOrganization'),
  ImportUserData: step('ImportUserData'),
  SelectKeys: step('SelectKeys'),
  PerformSetup: step('PerformSetup'),
  Summary: step('Summary'),
};

const toastManager = new ToastManager();

const PHRASE = { words: ['inmate', 'modify', 'chronic'], hash: 'phrase-hash' };
const PASSWORD_USER = {
  personalId: 'personal-id',
  useKeychain: false,
  email: 'user@example.com',
  password: 'personalPassword',
};
const KEYCHAIN_USER = { personalId: 'static-id', useKeychain: true, email: null, password: null };
const ORG_SETUP = {
  organizationURL: 'https://org.example.com',
  organizationEmail: 'user@example.com',
  organizationNickname: 'My Org',
  temporaryOrganizationPassword: 'tempPass123',
  newOrganizationPassword: 'newPass456',
};
const KEY_PATHS = ['/TransactionTools/Keys/testkey1.pem', '/TransactionTools/Keys/my.key.2.pem'];

const mountWizard = () =>
  mount(Migrate, {
    global: { provide: { [ToastManager.injectKey]: toastManager }, stubs: Stubs },
  });

type Wizard = ReturnType<typeof mountWizard>;
const emitFrom = async (wrapper: Wizard, name: keyof typeof Stubs, event: string, ...args: unknown[]) => {
  wrapper.getComponent(Stubs[name]).vm.$emit(event, ...args);
  await flushPromises();
};
const currentSteps = (wrapper: Wizard) =>
  wrapper.findAll('[data-step]').map(el => el.attributes('data-step'));

const toPersonal = async (wrapper: Wizard, phrase: typeof PHRASE | null = PHRASE) => {
  await emitFrom(wrapper, 'DecryptRecoveryPhrase', 'setRecoveryPhrase', {
    recoveryPhrase: phrase,
    recoveryPhrasePassword: phrase ? 'test_password' : null,
  });
};
const toOrganization = async (wrapper: Wizard, user = PASSWORD_USER, phrase = PHRASE) => {
  await toPersonal(wrapper, phrase);
  await emitFrom(wrapper, 'SetupPersonal', 'setPersonalUser', user);
};

describe('Migrate.vue wizard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    toastManager.reset();
    mocks.getDataMigrationKeysPath.mockResolvedValue('/TransactionTools/Keys');
    mocks.searchEncryptedKeys.mockResolvedValue(KEY_PATHS);
    mocks.getStaticUser.mockResolvedValue({ id: 'static-id', email: 'static@example.com' });
  });

  test('starts at the recovery phrase password step', () => {
    const wrapper = mountWizard();

    expect(currentSteps(wrapper)).toEqual(['DecryptRecoveryPhrase']);
    expect(wrapper.get('h4').text()).toBe('Recovery Phrase Password');
  });

  describe('recovery phrase step', () => {
    test('a decrypted phrase moves on to personal setup and hands the phrase over', async () => {
      const wrapper = mountWizard();

      await toPersonal(wrapper);

      expect(currentSteps(wrapper)).toEqual(['SetupPersonal']);
      expect(wrapper.getComponent(Stubs.SetupPersonal).props('recoveryPhrase')).toEqual(PHRASE);
    });

    test('skipping the phrase also moves on, with no phrase', async () => {
      const wrapper = mountWizard();

      await toPersonal(wrapper, null);

      expect(currentSteps(wrapper)).toEqual(['SetupPersonal']);
      expect(wrapper.getComponent(Stubs.SetupPersonal).props('recoveryPhrase')).toBeUndefined();
    });

    test('looks up the encrypted keys in the TTv1 export for the key selection step', async () => {
      const wrapper = mountWizard();

      await toPersonal(wrapper);

      expect(mocks.searchEncryptedKeys).toHaveBeenCalledWith(['/TransactionTools/Keys']);
    });
  });

  describe('personal step', () => {
    test('moves on to organization setup and marks the account setup as started', async () => {
      const wrapper = mountWizard();

      await toOrganization(wrapper);

      expect(mocks.user.setAccountSetupStarted).toHaveBeenCalledWith(true);
      expect(currentSteps(wrapper)).toEqual(['SetupOrganization']);
      expect(wrapper.getComponent(Stubs.SetupOrganization).props('personalUser')).toEqual(
        PASSWORD_USER,
      );
    });
  });

  describe('organization step', () => {
    test('joining an organization logs the personal user in with their password', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', ORG_SETUP, 'jwt-token');

      expect(mocks.user.login).toHaveBeenCalledWith('personal-id', 'user@example.com', false);
      expect(mocks.user.setPassword).toHaveBeenCalledWith('personalPassword');
      expect(mocks.user.setRecoveryPhrase).toHaveBeenCalledWith(PHRASE.words);
    });

    test('a keychain user is logged in as the static user and has no password set', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper, KEYCHAIN_USER as typeof PASSWORD_USER);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', ORG_SETUP, 'jwt-token');

      expect(mocks.user.login).toHaveBeenCalledWith('static-id', 'static@example.com', true);
      expect(mocks.user.setPassword).not.toHaveBeenCalled();
    });

    test('skipping the organization still initializes the user, so the data import can run', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', null, null);

      expect(mocks.user.login).toHaveBeenCalledWith('personal-id', 'user@example.com', false);
      expect(wrapper.findComponent(Stubs.ImportUserData).exists()).toBe(true);
    });

    test('no recovery phrase is set on the user when the phrase step was skipped', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper, PASSWORD_USER, null as unknown as typeof PHRASE);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', null, null);

      expect(mocks.user.setRecoveryPhrase).not.toHaveBeenCalled();
    });

    test('stores the skip-recovery-phrase claim once the organization (if any) is selected', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', ORG_SETUP, 'jwt-token');

      expect(mocks.accountSetup.storeSkipRecoveryPhraseClaim).toHaveBeenCalledTimes(1);
    });

    test('goes to key selection when the export has encrypted keys, for either route', async () => {
      for (const [setup, token] of [
        [ORG_SETUP, 'jwt-token'],
        [null, null],
      ] as const) {
        const wrapper = mountWizard();
        await toOrganization(wrapper);

        await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', setup, token);

        expect(currentSteps(wrapper)).toContain('SelectKeys');
        expect(currentSteps(wrapper)).not.toContain('PerformSetup');
      }
    });

    test('offers the keys found in the export, named after their files', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', null, null);

      const keys = wrapper.getComponent(Stubs.SelectKeys).props('keysToRecover') as {
        fileName: string;
        filepath: string;
      }[];
      expect(keys.map(k => [k.fileName, k.filepath])).toEqual([
        ['testkey1', KEY_PATHS[0]],
        ['my.key.2', KEY_PATHS[1]],
      ]);
    });

    test('skips key selection when the export has no encrypted keys', async () => {
      mocks.searchEncryptedKeys.mockResolvedValue([]);
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', ORG_SETUP, 'jwt-token');

      expect(currentSteps(wrapper)).toContain('PerformSetup');
      expect(currentSteps(wrapper)).not.toContain('SelectKeys');
      const perform = wrapper.getComponent(Stubs.PerformSetup);
      expect(perform.props('organizationSetup')).toEqual(ORG_SETUP);
      expect(perform.props('jwtToken')).toBe('jwt-token');
    });

    test('a skipped organization reaches the setup with no organization or token', async () => {
      mocks.searchEncryptedKeys.mockResolvedValue([]);
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', null, null);

      const perform = wrapper.getComponent(Stubs.PerformSetup);
      expect(perform.props('organizationSetup')).toBeNull();
      expect(perform.props('jwtToken')).toBeNull();
    });
  });

  describe('key selection step', () => {
    const toSelectKeys = async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);
      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', ORG_SETUP, 'jwt-token');
      return wrapper;
    };

    test('the selected keys are passed on to the setup', async () => {
      const wrapper = await toSelectKeys();
      const selected = [{ fileName: 'testkey1', filepath: KEY_PATHS[0] }];

      await emitFrom(wrapper, 'SelectKeys', 'selected-keys', selected);

      expect(currentSteps(wrapper)).toContain('PerformSetup');
      expect(wrapper.getComponent(Stubs.PerformSetup).props('selectedKeys')).toEqual(selected);
    });

    test('skipping key selection still runs the setup, with no keys', async () => {
      const wrapper = await toSelectKeys();

      await emitFrom(wrapper, 'SelectKeys', 'selected-keys', []);

      expect(wrapper.getComponent(Stubs.PerformSetup).props('selectedKeys')).toEqual([]);
    });

    test('the recovery phrase and its password are handed to the setup', async () => {
      const wrapper = await toSelectKeys();

      await emitFrom(wrapper, 'SelectKeys', 'selected-keys', []);

      const perform = wrapper.getComponent(Stubs.PerformSetup);
      expect(perform.props('recoveryPhrase')).toEqual(PHRASE);
      expect(perform.props('recoveryPhrasePassword')).toBe('test_password');
    });
  });

  describe('setup finished', () => {
    const toPerformSetup = async () => {
      mocks.searchEncryptedKeys.mockResolvedValue([]);
      const wrapper = mountWizard();
      await toOrganization(wrapper);
      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', ORG_SETUP, 'jwt-token');
      return wrapper;
    };

    test('shows the summary with the number of imported keys', async () => {
      const wrapper = await toPerformSetup();

      await emitFrom(wrapper, 'PerformSetup', 'didPerformSetup', 2, null);

      expect(currentSteps(wrapper)).toContain('Summary');
      expect(wrapper.get('h4').text()).toBe('Summary');
      expect(wrapper.getComponent(Stubs.Summary).props('importedKeysCount')).toBe(2);
      expect(toastManager.findEntry('Organization setup failed', 'error')).toBeNull();
    });

    test('no imported keys re-stores the skip-recovery-phrase claim', async () => {
      const wrapper = await toPerformSetup();
      mocks.accountSetup.storeSkipRecoveryPhraseClaim.mockClear();

      await emitFrom(wrapper, 'PerformSetup', 'didPerformSetup', 0, null);

      expect(mocks.accountSetup.storeSkipRecoveryPhraseClaim).toHaveBeenCalledTimes(1);
    });

    test('imported keys do not store the claim again', async () => {
      const wrapper = await toPerformSetup();
      mocks.accountSetup.storeSkipRecoveryPhraseClaim.mockClear();

      await emitFrom(wrapper, 'PerformSetup', 'didPerformSetup', 1, null);

      expect(mocks.accountSetup.storeSkipRecoveryPhraseClaim).not.toHaveBeenCalled();
    });

    test('a setup error is shown in a toast but the summary is still reached', async () => {
      const wrapper = await toPerformSetup();

      await emitFrom(wrapper, 'PerformSetup', 'didPerformSetup', 0, new Error('Server unreachable'));

      expect(toastManager.findEntry('Server unreachable', 'error')).not.toBeNull();
      expect(currentSteps(wrapper)).toContain('Summary');
    });

    test('the imported TTv1 data is shown in the summary', async () => {
      const wrapper = await toPerformSetup();
      const imported = { accountsImported: 2, publicKeysImported: 1, defaultMaxTransactionFee: null, currentNetwork: 'mainnet' };

      await emitFrom(wrapper, 'ImportUserData', 'importedUserData', imported);
      await emitFrom(wrapper, 'PerformSetup', 'didPerformSetup', 1, null);

      expect(wrapper.getComponent(Stubs.Summary).props('importedUserData')).toEqual(imported);
    });
  });

  describe('cancelling', () => {
    const expectMigrationStopped = () => {
      expect(mocks.user.setAccountSetupStarted).toHaveBeenLastCalledWith(false);
      expect(mocks.resetDataLocal).toHaveBeenCalledTimes(1);
      expect(mocks.user.logout).toHaveBeenCalledTimes(1);
      expect(mocks.router.push).toHaveBeenCalledWith({ name: 'login' });
    };

    test('from the recovery phrase step', async () => {
      const wrapper = mountWizard();

      await emitFrom(wrapper, 'DecryptRecoveryPhrase', 'stopMigration');

      expectMigrationStopped();
    });

    test('from the personal step', async () => {
      const wrapper = mountWizard();
      await toPersonal(wrapper);

      await emitFrom(wrapper, 'SetupPersonal', 'migration:cancel');

      expectMigrationStopped();
    });

    test('from the organization step', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);

      await emitFrom(wrapper, 'SetupOrganization', 'migration:cancel');

      expectMigrationStopped();
    });

    test('from the key selection step', async () => {
      const wrapper = mountWizard();
      await toOrganization(wrapper);
      await emitFrom(wrapper, 'SetupOrganization', 'setOrganizationSetup', null, null);

      await emitFrom(wrapper, 'SelectKeys', 'migration:cancel');

      expectMigrationStopped();
    });
  });
});
