// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import type { MigrateUserDataResult } from '@shared/interfaces/migration';
import Summary from '@renderer/pages/Migrate/components/Summary.vue';
import { ToastManager } from '@renderer/utils/ToastManager';

import { buttonStub } from './migrationStubs';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  performVersionCheck: vi.fn(),
  isLoggedInOrganization: vi.fn(),
  user: {} as Record<string, any>,
}));

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));
vi.mock('@renderer/composables/useVersionCheck', () => ({
  default: () => ({ performVersionCheck: mocks.performVersionCheck }),
}));
vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: mocks.isLoggedInOrganization,
  isUserLoggedIn: (user: { isLoggedIn?: boolean } | null) => Boolean(user?.isLoggedIn),
}));

const toastManager = new ToastManager();

const imported = (overrides: Partial<MigrateUserDataResult> = {}): MigrateUserDataResult => ({
  accountsImported: 2,
  publicKeysImported: 1,
  defaultMaxTransactionFee: 200000000,
  currentNetwork: 'testnet',
  ...overrides,
});

const mounted: { unmount: () => void }[] = [];

const mountStep = (importedUserData: MigrateUserDataResult | null = imported(), keys = 2) => {
  const wrapper = mount(Summary, {
    props: { importedKeysCount: keys, importedUserData },
    global: {
      provide: { [ToastManager.injectKey]: toastManager },
      stubs: { AppButton: buttonStub },
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
};

const rowFor = (wrapper: ReturnType<typeof mountStep>, label: string) =>
  wrapper.findAll('.row').find(row => row.find('p').text() === label);

const value = (wrapper: ReturnType<typeof mountStep>, label: string) =>
  rowFor(wrapper, label)?.findAll('p')[1].text();

describe('Migrate: summary step', () => {
  afterEach(() => {
    // Summary listens for document copy events, so leaked instances would affect later tests
    mounted.splice(0).forEach(wrapper => wrapper.unmount());
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isLoggedInOrganization.mockReturnValue(false);
    mocks.user = {
      selectedOrganization: null,
      personal: { isLoggedIn: true, useKeychain: false },
      recoveryPhrase: null,
      setAccountSetupStarted: vi.fn(),
    };
  });

  test('marks account setup as finished as soon as it is shown', () => {
    mountStep();

    expect(mocks.user.setAccountSetupStarted).toHaveBeenCalledWith(false);
  });

  describe('imported data', () => {
    test('shows the imported key, public key, account and network counts', () => {
      const wrapper = mountStep(imported({ accountsImported: 3, publicKeysImported: 4 }), 5);

      expect(value(wrapper, 'Imported Key Pairs')).toBe('5');
      expect(value(wrapper, 'Imported Public Keys')).toBe('4');
      expect(value(wrapper, 'Imported Accounts')).toBe('3');
      expect(value(wrapper, 'Imported Network')).toBe('testnet');
    });

    test('shows the default max transaction fee in Hbar', () => {
      const wrapper = mountStep(imported({ defaultMaxTransactionFee: 200000000 }));

      expect(value(wrapper, 'Imported Default Max Transaction Fee')).toBe('2 ℏ');
    });

    test('hides public keys, accounts and fee when none were imported', () => {
      const wrapper = mountStep(
        imported({ accountsImported: 0, publicKeysImported: 0, defaultMaxTransactionFee: null }),
      );

      expect(rowFor(wrapper, 'Imported Public Keys')).toBeUndefined();
      expect(wrapper.text()).not.toContain('Imported Accounts');
      expect(wrapper.text()).not.toContain('Imported Default Max Transaction Fee');
    });

    test('shows only the key count when no user data was imported', () => {
      const wrapper = mountStep(null, 1);

      expect(value(wrapper, 'Imported Key Pairs')).toBe('1');
      expect(rowFor(wrapper, 'Imported Network')).toBeUndefined();
      expect(wrapper.text()).not.toContain('Imported Accounts');
    });
  });

  test('renders each row with its own test id', () => {
    const wrapper = mountStep();
    const ids = wrapper
      .findAll('[data-testid^="p-migration-summary-"]')
      .map(e => e.attributes('data-testid'));

    expect(ids).toContain('p-migration-summary-imported-keys');
    expect(ids).toContain('p-migration-summary-imported-max-fee');
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('account details', () => {
    test('shows None for the organization when none was set up', () => {
      const wrapper = mountStep();

      expect(value(wrapper, 'Organization Nickname')).toBe('None');
      expect(value(wrapper, 'Organization URL')).toBe('None');
      expect(value(wrapper, 'Organization Email')).toBe('None');
    });

    test('shows the organization nickname, URL and email when logged in', () => {
      mocks.isLoggedInOrganization.mockReturnValue(true);
      mocks.user.selectedOrganization = {
        nickname: 'Org 1',
        serverUrl: 'https://org.example.com',
        email: 'user@example.com',
      };
      const wrapper = mountStep();

      expect(value(wrapper, 'Organization Nickname')).toBe('Org 1');
      expect(value(wrapper, 'Organization URL')).toBe('https://org.example.com');
      expect(value(wrapper, 'Organization Email')).toBe('user@example.com');
    });

    test.each([
      [true, 'Yes'],
      [false, 'No'],
    ])('shows keychain usage %s as %s', (useKeychain, expected) => {
      mocks.user.personal = { isLoggedIn: true, useKeychain };
      const wrapper = mountStep();

      expect(value(wrapper, 'Using Keychain')).toBe(expected);
    });
  });

  describe('recovery phrase', () => {
    const words = ['inmate', 'modify', 'chronic'];

    test('is not shown when the user skipped it', () => {
      expect(mountStep().text()).not.toContain('Recovery Phrase');
    });

    test('lists the numbered words when present', () => {
      mocks.user.recoveryPhrase = { words };
      const wrapper = mountStep();

      expect(wrapper.text()).toContain('Recovery Phrase');
      expect(wrapper.text()).toContain('1.inmate');
      expect(wrapper.text()).toContain('3.chronic');
    });

    test('copy button writes the comma separated phrase to the clipboard', async () => {
      mocks.user.recoveryPhrase = { words };
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const success = vi.spyOn(toastManager, 'success');
      const wrapper = mountStep();

      await wrapper.get('[log-label="copy-recovery-phrase"]').trigger('click');
      await flushPromises();

      expect(writeText).toHaveBeenCalledWith('inmate, modify, chronic');
      expect(success).toHaveBeenCalledWith('Recovery phrase copied to clipboard');
    });
  });

  describe('finish', () => {
    test('goes to the keys settings page', async () => {
      const wrapper = mountStep();

      await wrapper.get('[data-testid="button-finish-migration"]').trigger('click');
      await flushPromises();

      expect(mocks.push).toHaveBeenCalledWith({ name: 'settingsKeys' });
      expect(mocks.performVersionCheck).not.toHaveBeenCalled();
    });

    test('checks the organization for updates when logged in to one', async () => {
      mocks.isLoggedInOrganization.mockReturnValue(true);
      mocks.user.selectedOrganization = { serverUrl: 'https://org.example.com' };
      const wrapper = mountStep();

      await wrapper.get('[data-testid="button-finish-migration"]').trigger('click');
      await flushPromises();

      expect(mocks.performVersionCheck).toHaveBeenCalledWith('https://org.example.com');
    });
  });
});
