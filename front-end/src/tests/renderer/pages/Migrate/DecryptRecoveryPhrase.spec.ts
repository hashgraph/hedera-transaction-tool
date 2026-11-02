// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import DecryptRecoveryPhrase from '@renderer/pages/Migrate/components/DecryptRecoveryPhrase.vue';

import { buttonStub, inputStub } from './migrationStubs';

const mocks = vi.hoisted(() => ({
  decryptMigrationMnemonic: vi.fn(),
  createRecoveryPhrase: vi.fn(),
}));

vi.mock('@renderer/services/migrateDataService', () => ({
  decryptMigrationMnemonic: mocks.decryptMigrationMnemonic,
}));
vi.mock('@renderer/utils', () => ({
  safeAwait: async (promise: Promise<unknown>) => {
    try {
      return { data: await promise };
    } catch (error) {
      return { error };
    }
  },
  createRecoveryPhrase: mocks.createRecoveryPhrase,
}));

const WORDS = ['inmate', 'modify', 'chronic'];
const PHRASE = { words: WORDS, hash: 'phrase-hash' };

const mountStep = () =>
  mount(DecryptRecoveryPhrase, {
    global: { stubs: { AppButton: buttonStub, AppPasswordInput: inputStub } },
  });

const enterPassword = async (wrapper: ReturnType<typeof mountStep>, value: string) => {
  await wrapper.get('[data-testid="input-recovery-phrase-decryption-password"]').setValue(value);
};

const submit = async (wrapper: ReturnType<typeof mountStep>) => {
  await wrapper.get('form').trigger('submit');
  await flushPromises();
};

describe('Migrate: recovery phrase step', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createRecoveryPhrase.mockResolvedValue(PHRASE);
  });

  test('a correct password decrypts the TTv1 recovery phrase and hands it to the wizard', async () => {
    mocks.decryptMigrationMnemonic.mockResolvedValue(WORDS);
    const wrapper = mountStep();

    await enterPassword(wrapper, 'test_password');
    await submit(wrapper);

    expect(mocks.decryptMigrationMnemonic).toHaveBeenCalledWith('test_password');
    expect(mocks.createRecoveryPhrase).toHaveBeenCalledWith(WORDS);
    expect(wrapper.emitted('setRecoveryPhrase')).toEqual([
      [{ recoveryPhrase: PHRASE, recoveryPhrasePassword: 'test_password' }],
    ]);
  });

  test('the password is trimmed before it is used', async () => {
    mocks.decryptMigrationMnemonic.mockResolvedValue(WORDS);
    const wrapper = mountStep();

    await enterPassword(wrapper, '  test_password  ');
    await submit(wrapper);

    expect(mocks.decryptMigrationMnemonic).toHaveBeenCalledWith('test_password');
  });

  test('a wrong password shows an error and does not continue', async () => {
    mocks.decryptMigrationMnemonic.mockResolvedValue(null);
    const wrapper = mountStep();

    await enterPassword(wrapper, 'wrong');
    await submit(wrapper);

    expect(wrapper.get('[data-testid="invalid-text-recovery-password"]').text()).toBe(
      'Recovery phrase password is incorrect. Try a different password.',
    );
    expect(wrapper.emitted('setRecoveryPhrase')).toBeUndefined();
  });

  test('a failure while decrypting is reported as an incorrect password, not thrown', async () => {
    mocks.decryptMigrationMnemonic.mockRejectedValue(new Error('No hash found at location'));
    const wrapper = mountStep();

    await enterPassword(wrapper, 'anything');
    await submit(wrapper);

    expect(wrapper.find('[data-testid="invalid-text-recovery-password"]').exists()).toBe(true);
    expect(wrapper.emitted('setRecoveryPhrase')).toBeUndefined();
  });

  test('the error clears once the user edits the password', async () => {
    mocks.decryptMigrationMnemonic.mockResolvedValue(null);
    const wrapper = mountStep();

    await enterPassword(wrapper, 'wrong');
    await submit(wrapper);
    await enterPassword(wrapper, 'wrong2');

    expect(wrapper.find('[data-testid="invalid-text-recovery-password"]').exists()).toBe(false);
  });

  test('Continue is disabled and nothing is decrypted while the password is empty', async () => {
    const wrapper = mountStep();

    expect(
      wrapper.get('[data-testid="button-decrypt-recovery-phrase"]').attributes('disabled'),
    ).toBeDefined();

    await enterPassword(wrapper, '   ');
    await submit(wrapper);

    expect(mocks.decryptMigrationMnemonic).not.toHaveBeenCalled();
  });

  test('Skip continues without a recovery phrase and without decrypting anything', async () => {
    const wrapper = mountStep();

    await wrapper.get('[data-testid="button-skip-recovery-phrase-decryption"]').trigger('click');

    expect(mocks.decryptMigrationMnemonic).not.toHaveBeenCalled();
    expect(wrapper.emitted('setRecoveryPhrase')).toEqual([
      [{ recoveryPhrase: null, recoveryPhrasePassword: null }],
    ]);
  });

  test('Back stops the migration', async () => {
    const wrapper = mountStep();

    await wrapper.get('[data-testid="button-stop-migration"]').trigger('click');

    expect(wrapper.emitted('stopMigration')).toHaveLength(1);
  });
});
