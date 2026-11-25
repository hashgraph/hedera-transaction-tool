// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { Mnemonic } from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  user: null as any,
  storeKey: vi.fn(),
  refetchUserState: vi.fn(),
  setRecoveryPhrase: vi.fn(),
  getPassword: vi.fn(),
  setNickname: vi.fn(),
  setWords: vi.fn(),
  restorePrivateKey: vi.fn(),
  compareDataToHashes: vi.fn(),
  isLoggedInOrganization: vi.fn(),
  safeDuplicateUploadKey: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', async () => {
  const { reactive } = await import('vue');
  mocks.user = reactive({
    personal: { id: 'user-1' },
    recoveryPhrase: null,
    keyPairs: [],
    mnemonics: [],
    selectedOrganization: null,
    storeKey: mocks.storeKey,
    refetchUserState: mocks.refetchUserState,
    setRecoveryPhrase: mocks.setRecoveryPhrase,
  });
  return { default: () => mocks.user };
});
vi.mock('@renderer/composables/useRecoveryPhraseNickname', () => ({
  default: () => ({
    get: (hash: string) =>
      mocks.user.mnemonics.find((m: any) => m.mnemonicHash === hash)?.nickname || null,
    set: mocks.setNickname,
  }),
}));
vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: () => ({
    getPassword: mocks.getPassword,
    passwordModalOpened: (result: unknown) => result === false,
  }),
}));
vi.mock('@renderer/services/keyPairService', () => ({
  restorePrivateKey: mocks.restorePrivateKey,
}));
vi.mock('@renderer/services/electronUtilsService', () => ({
  compareDataToHashes: mocks.compareDataToHashes,
}));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: mocks.toastSuccess, error: mocks.toastError }) },
}));
vi.mock('@renderer/utils/logger', () => ({ createLogger: () => mocks.logger }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
  isLoggedInOrganization: mocks.isLoggedInOrganization,
  safeDuplicateUploadKey: mocks.safeDuplicateUploadKey,
}));

const stubs = {
  AppModal: { props: ['show'], template: '<div v-if="show"><slot /></div>' },
  AppButton: {
    props: ['disabled', 'loading', 'loadingText'],
    template:
      '<button v-bind="$attrs" :disabled="disabled || loading"><slot />{{ loading ? loadingText : "" }}</button>',
  },
  AppInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  RecoveryPhraseInput: {
    props: ['shouldClear'],
    setup(_: unknown, { expose }: { expose: (exposed: object) => void }) {
      expose({ setWords: mocks.setWords });
      return () => null;
    },
  },
};

const WORDS = Array.from({ length: 24 }, (_, i) => `word${i}`);
const PHRASE_HASH = 'fresh-hash';

// The last selected key type lives at module scope, so every test gets a fresh module
async function mountModal(show = true) {
  vi.resetModules();
  const Modal = (await import('@renderer/components/RecoveryPhraseKeyModal.vue')).default;
  return mount(Modal, { props: { show }, global: { stubs } });
}

type Wrapper = Awaited<ReturnType<typeof mountModal>>;
const find = (wrapper: Wrapper, testid: string) => wrapper.find(`[data-testid="${testid}"]`);
const value = (wrapper: Wrapper, testid: string) =>
  (find(wrapper, testid).element as HTMLInputElement).value;
const click = async (wrapper: Wrapper, testid: string) => {
  await find(wrapper, testid).trigger('click');
  await flushPromises();
};
const setPhrase = async (words = WORDS, hash = PHRASE_HASH) => {
  mocks.user.recoveryPhrase = { words, hash, mnemonic: {} };
  await flushPromises();
};
const goToStep2 = async (wrapper: Wrapper) => {
  await wrapper.findAll('form')[0].trigger('submit');
  await flushPromises();
};
const save = async (wrapper: Wrapper) => {
  await wrapper.findAll('form')[1].trigger('submit');
  await flushPromises();
};
const selectType = async (wrapper: Wrapper, type: 'ED25519' | 'ECDSA') => {
  await find(wrapper, `select-item-${type}`).trigger('click');
  await flushPromises();
};
const typeToggle = (wrapper: Wrapper) => find(wrapper, 'select-recovery-key-type').text();
// Step 1 is hidden with v-show, which sets an inline display: none
const step1IsVisible = (wrapper: Wrapper) =>
  !(wrapper.findAll('form')[0].attributes('style') ?? '').includes('display: none');

const derivedKey = (type: string, index: number) => ({
  publicKey: { toStringRaw: () => `${type}-pub-${index}` },
  toStringRaw: () => `${type}-priv-${index}`,
});

describe('RecoveryPhraseKeyModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The mocked store is cached across tests, so its state must be reset by hand
    if (mocks.user) {
      mocks.user.recoveryPhrase = null;
      mocks.user.keyPairs = [];
      mocks.user.mnemonics = [];
      mocks.user.selectedOrganization = null;
    }
    mocks.storeKey.mockReset().mockResolvedValue(undefined);
    mocks.refetchUserState.mockReset().mockResolvedValue(undefined);
    mocks.setRecoveryPhrase.mockReset().mockResolvedValue(undefined);
    mocks.getPassword.mockReturnValue('pw');
    mocks.setNickname.mockResolvedValue(undefined);
    mocks.compareDataToHashes.mockResolvedValue(null);
    mocks.isLoggedInOrganization.mockReturnValue(false);
    mocks.safeDuplicateUploadKey.mockResolvedValue(undefined);
    mocks.restorePrivateKey.mockImplementation(
      async (_words: string[], _passphrase: string, index: number, type: string) =>
        derivedKey(type, index),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('step 1: the recovery phrase', () => {
    test('starts on step 1, with Next and Copy disabled until there is a phrase', async () => {
      const wrapper = await mountModal();

      expect(step1IsVisible(wrapper)).toBe(true);
      expect(find(wrapper, 'button-continue-phrase').attributes('disabled')).toBeDefined();
      expect(find(wrapper, 'button-copy-phrase').attributes('disabled')).toBeDefined();
    });

    test('enables Next and Copy once the phrase is valid', async () => {
      const wrapper = await mountModal();

      await setPhrase();

      expect(find(wrapper, 'button-continue-phrase').attributes('disabled')).toBeUndefined();
      expect(find(wrapper, 'button-copy-phrase').attributes('disabled')).toBeUndefined();
    });

    test('does not move to step 2 without a phrase', async () => {
      const wrapper = await mountModal();

      await goToStep2(wrapper);

      expect(find(wrapper, 'input-index').exists()).toBe(false);
    });

    describe('generating', () => {
      test('fills the grid with a new 24 word phrase', async () => {
        const wrapper = await mountModal();

        await click(wrapper, 'button-generate-phrase');

        expect(mocks.setWords).toHaveBeenCalledTimes(1);
        const words = mocks.setWords.mock.calls[0][0] as string[];
        expect(words).toHaveLength(24);
        expect(await Mnemonic.fromWords(words)).toBeDefined();
      });

      test('shows the save-your-phrase warning only after generating', async () => {
        const wrapper = await mountModal();
        expect(find(wrapper, 'label-save-recovery-phrase-warning').exists()).toBe(false);

        await click(wrapper, 'button-generate-phrase');

        expect(find(wrapper, 'label-save-recovery-phrase-warning').text()).toContain(
          'Save this recovery phrase',
        );
      });

      test('the button becomes Regenerate, which generates a different phrase', async () => {
        const wrapper = await mountModal();
        expect(find(wrapper, 'button-generate-phrase').text()).toBe('Generate');

        await click(wrapper, 'button-generate-phrase');
        expect(find(wrapper, 'button-generate-phrase').text()).toBe('Regenerate');
        await click(wrapper, 'button-generate-phrase');

        expect(mocks.setWords).toHaveBeenCalledTimes(2);
        expect(mocks.setWords.mock.calls[0][0]).not.toEqual(mocks.setWords.mock.calls[1][0]);
      });

      test('can replace a phrase that was typed or pasted', async () => {
        const wrapper = await mountModal();
        await setPhrase();

        await click(wrapper, 'button-generate-phrase');

        expect(mocks.setWords).toHaveBeenCalledTimes(1);
      });

      test('Clear removes the warning and goes back to Generate', async () => {
        const wrapper = await mountModal();
        await click(wrapper, 'button-generate-phrase');

        await wrapper
          .findAll('button')
          .find(b => b.text() === 'Clear')!
          .trigger('click');
        await flushPromises();

        expect(find(wrapper, 'label-save-recovery-phrase-warning').exists()).toBe(false);
        expect(find(wrapper, 'button-generate-phrase').text()).toBe('Generate');
        expect(mocks.setRecoveryPhrase).toHaveBeenCalledWith(null);
      });

      test('reports and logs a failure to generate', async () => {
        const failure = new Error('no entropy');
        vi.spyOn(Mnemonic, 'generate').mockRejectedValue(failure);
        const wrapper = await mountModal();

        await click(wrapper, 'button-generate-phrase');

        expect(mocks.toastError).toHaveBeenCalledWith('no entropy');
        expect(mocks.logger.error).toHaveBeenCalledWith('Failed to generate recovery phrase', {
          error: failure,
        });
        expect(find(wrapper, 'label-save-recovery-phrase-warning').exists()).toBe(false);
      });

      test('logs generating and regenerating, without the words', async () => {
        const wrapper = await mountModal();

        await click(wrapper, 'button-generate-phrase');
        await click(wrapper, 'button-generate-phrase');

        expect(mocks.logger.info.mock.calls).toEqual([
          ['Recovery phrase generated', { regenerated: false }],
          ['Recovery phrase generated', { regenerated: true }],
        ]);
      });
    });

    describe('copying', () => {
      let writeText: ReturnType<typeof vi.fn>;
      beforeEach(() => {
        writeText = vi.fn();
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });
      });

      test('copies the whole phrase, comma separated', async () => {
        const wrapper = await mountModal();
        await setPhrase();

        await click(wrapper, 'button-copy-phrase');

        expect(writeText).toHaveBeenCalledWith(WORDS.join(', '));
        expect(mocks.toastSuccess).toHaveBeenCalledWith('Recovery phrase copied');
      });

      test('does not copy anything without a valid phrase', async () => {
        const wrapper = await mountModal();

        await click(wrapper, 'button-copy-phrase');

        expect(writeText).not.toHaveBeenCalled();
      });

      test('logs that it was copied, never the words', async () => {
        const wrapper = await mountModal();
        await setPhrase();

        await click(wrapper, 'button-copy-phrase');

        expect(mocks.logger.info).toHaveBeenCalledWith('Recovery phrase copied to clipboard');
        expect(JSON.stringify(mocks.logger.info.mock.calls)).not.toContain('word1');
      });
    });

    describe('the nickname of a phrase that is already known', () => {
      test('is filled in when the phrase matches a stored one', async () => {
        mocks.compareDataToHashes.mockResolvedValue('stored-hash');
        const wrapper = await mountModal();
        mocks.user.mnemonics = [{ mnemonicHash: 'stored-hash', nickname: 'Savings' }];

        await setPhrase();

        expect(value(wrapper, 'input-recovery-phrase-nickname')).toBe('Savings');
      });

      test('is empty for a phrase nobody has seen before', async () => {
        const wrapper = await mountModal();
        mocks.user.mnemonics = [{ mnemonicHash: 'stored-hash', nickname: 'Savings' }];

        await setPhrase();

        expect(value(wrapper, 'input-recovery-phrase-nickname')).toBe('');
      });

      test('is looked up by comparing the phrase with every known hash', async () => {
        await mountModal();
        mocks.user.mnemonics = [{ mnemonicHash: 'phrase-a', nickname: 'A' }];
        mocks.user.keyPairs = [{ secret_hash: 'phrase-b' }, { secret_hash: null }];

        await setPhrase();

        const [data, hashes] = mocks.compareDataToHashes.mock.calls[0];
        expect(typeof data).toBe('string');
        expect(hashes.sort()).toEqual(['phrase-a', 'phrase-b']);
      });

      test('does not compare the same hash twice', async () => {
        await mountModal();
        mocks.user.mnemonics = [{ mnemonicHash: 'same', nickname: 'A' }];
        mocks.user.keyPairs = [{ secret_hash: 'same' }, { secret_hash: 'same' }];

        await setPhrase();

        expect(mocks.compareDataToHashes.mock.calls[0][1]).toEqual(['same']);
      });

      test('also considers the hashes of the keys uploaded to the organization', async () => {
        mocks.isLoggedInOrganization.mockReturnValue(true);
        await mountModal();
        mocks.user.selectedOrganization = {
          id: 'org-1',
          userKeys: [{ mnemonicHash: 'org-hash' }, { mnemonicHash: null }],
        };

        await setPhrase();

        expect(mocks.compareDataToHashes.mock.calls[0][1]).toEqual(['org-hash']);
      });

      test('logs, and carries on, when the comparison fails', async () => {
        const failure = new Error('ipc failed');
        mocks.compareDataToHashes.mockRejectedValue(failure);
        const wrapper = await mountModal();

        await setPhrase();

        expect(mocks.logger.error).toHaveBeenCalledWith(
          'Failed to look up the recovery phrase nickname',
          { error: failure },
        );
        expect(find(wrapper, 'button-continue-phrase').attributes('disabled')).toBeUndefined();
      });
    });
  });

  describe('step 2: the key details', () => {
    test('Next moves on to the key details', async () => {
      const wrapper = await mountModal();
      await setPhrase();

      await goToStep2(wrapper);

      expect(find(wrapper, 'input-index').exists()).toBe(true);
      expect(step1IsVisible(wrapper)).toBe(false);
    });

    test('Back returns to the phrase without losing it', async () => {
      const wrapper = await mountModal();
      await setPhrase();
      await goToStep2(wrapper);

      await click(wrapper, 'button-recovery-back');

      expect(step1IsVisible(wrapper)).toBe(true);
      expect(find(wrapper, 'input-index').exists()).toBe(false);
      expect(mocks.user.recoveryPhrase.words).toEqual(WORDS);
      expect(find(wrapper, 'button-continue-phrase').attributes('disabled')).toBeUndefined();
    });

    test('keeps the phrase nickname that was typed when going back and forth', async () => {
      const wrapper = await mountModal();
      await setPhrase();
      await find(wrapper, 'input-recovery-phrase-nickname').setValue('Vacation');
      await goToStep2(wrapper);
      await click(wrapper, 'button-recovery-back');

      expect(value(wrapper, 'input-recovery-phrase-nickname')).toBe('Vacation');
    });

    describe('key type', () => {
      test('defaults to ED25519', async () => {
        const wrapper = await mountModal();
        await setPhrase();
        await goToStep2(wrapper);

        expect(typeToggle(wrapper)).toBe('ED25519');
      });

      test('offers ED25519 and ECDSA', async () => {
        const wrapper = await mountModal();
        await setPhrase();
        await goToStep2(wrapper);

        expect(find(wrapper, 'select-item-ED25519').exists()).toBe(true);
        expect(find(wrapper, 'select-item-ECDSA').exists()).toBe(true);
      });
    });

    describe('key index', () => {
      test('starts at the first index that has no key yet', async () => {
        const wrapper = await mountModal();
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }, { public_key: 'ED25519-pub-1' }];
        await setPhrase();
        await goToStep2(wrapper);

        expect(value(wrapper, 'input-index')).toBe('2');
      });

      test('starts at 0 for a phrase with no keys', async () => {
        const wrapper = await mountModal();
        await setPhrase();
        await goToStep2(wrapper);

        expect(value(wrapper, 'input-index')).toBe('0');
      });

      test('is worked out again for the other key type, whose keys are different', async () => {
        const wrapper = await mountModal();
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }, { public_key: 'ED25519-pub-1' }];
        await setPhrase();
        await goToStep2(wrapper);

        await selectType(wrapper, 'ECDSA');

        expect(value(wrapper, 'input-index')).toBe('0');
        expect(mocks.restorePrivateKey).toHaveBeenCalledWith(WORDS, '', 0, 'ECDSA');
      });

      test('stops being picked automatically once the user typed an index', async () => {
        const wrapper = await mountModal();
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }];
        await setPhrase();
        await goToStep2(wrapper);

        await find(wrapper, 'input-index').setValue('7');
        await selectType(wrapper, 'ECDSA');

        expect(value(wrapper, 'input-index')).toBe('7');
      });

      test('is picked again for a different phrase', async () => {
        const wrapper = await mountModal();
        await setPhrase();
        await goToStep2(wrapper);
        await find(wrapper, 'input-index').setValue('7');
        await click(wrapper, 'button-recovery-back');

        await setPhrase(
          WORDS.map(w => `${w}x`),
          'other-hash',
        );

        await goToStep2(wrapper);
        expect(value(wrapper, 'input-index')).toBe('0');
      });

      test('disables Save for a negative index', async () => {
        const wrapper = await mountModal();
        await setPhrase();
        await goToStep2(wrapper);

        await find(wrapper, 'input-index').setValue('-1');

        expect(find(wrapper, 'button-save-recovery-key').attributes('disabled')).toBeDefined();
      });

      test('logs when the index search fails', async () => {
        const failure = new Error('derivation failed');
        mocks.restorePrivateKey.mockRejectedValue(failure);
        await mountModal();

        await setPhrase();

        expect(mocks.logger.error).toHaveBeenCalledWith('Failed to find an unused key index', {
          error: failure,
        });
      });
    });
  });

  describe('saving', () => {
    async function reachStep2(wrapper: Wrapper) {
      await setPhrase();
      await goToStep2(wrapper);
    }

    test('derives and stores an ED25519 key at the chosen index', async () => {
      const wrapper = await mountModal();
      await reachStep2(wrapper);
      await find(wrapper, 'input-index').setValue('3');
      await find(wrapper, 'input-nickname').setValue('Rent');

      await save(wrapper);

      expect(mocks.restorePrivateKey).toHaveBeenLastCalledWith(WORDS, '', 3, 'ED25519');
      expect(mocks.storeKey).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          index: 3,
          private_key: 'ED25519-priv-3',
          public_key: 'ED25519-pub-3',
          type: 'ED25519',
          organization_id: null,
          organization_user_id: null,
          secret_hash: PHRASE_HASH,
          nickname: 'Rent',
        },
        PHRASE_HASH,
        'pw',
        false,
      );
    });

    test('derives and stores an ECDSA key when ECDSA is selected', async () => {
      const wrapper = await mountModal();
      await reachStep2(wrapper);
      await selectType(wrapper, 'ECDSA');

      await save(wrapper);

      expect(mocks.restorePrivateKey).toHaveBeenLastCalledWith(WORDS, '', 0, 'ECDSA');
      expect(mocks.storeKey).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ECDSA',
          index: 0,
          public_key: 'ECDSA-pub-0',
          private_key: 'ECDSA-priv-0',
        }),
        PHRASE_HASH,
        'pw',
        false,
      );
    });

    test('stores an empty nickname as null', async () => {
      const wrapper = await mountModal();
      await reachStep2(wrapper);

      await save(wrapper);

      expect(mocks.storeKey).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: null }),
        PHRASE_HASH,
        'pw',
        false,
      );
    });

    test('reuses the stored hash when the phrase is already known', async () => {
      mocks.compareDataToHashes.mockResolvedValue('stored-hash');
      const wrapper = await mountModal();
      await reachStep2(wrapper);

      await save(wrapper);

      expect(mocks.storeKey).toHaveBeenCalledWith(
        expect.objectContaining({ secret_hash: 'stored-hash' }),
        'stored-hash',
        'pw',
        false,
      );
      expect(mocks.setNickname).toHaveBeenCalledWith('stored-hash', expect.any(String));
    });

    test('saves the nickname of the phrase', async () => {
      const wrapper = await mountModal();
      await setPhrase();
      await find(wrapper, 'input-recovery-phrase-nickname').setValue('Vacation');
      await goToStep2(wrapper);

      await save(wrapper);

      expect(mocks.setNickname).toHaveBeenCalledWith(PHRASE_HASH, 'Vacation');
    });

    test('closes, reports success, refreshes the user state and forgets the phrase', async () => {
      const wrapper = await mountModal();
      await reachStep2(wrapper);

      await save(wrapper);

      expect(wrapper.emitted('update:show')).toEqual([[false]]);
      expect(mocks.toastSuccess).toHaveBeenCalledWith('Key pair saved');
      expect(mocks.refetchUserState).toHaveBeenCalled();
      expect(mocks.user.recoveryPhrase).toBeNull();
    });

    test('shows a progress message on the button while saving', async () => {
      let finishStoring!: () => void;
      mocks.storeKey.mockReturnValue(new Promise<void>(resolve => (finishStoring = resolve)));
      const wrapper = await mountModal();
      await reachStep2(wrapper);

      await wrapper.findAll('form')[1].trigger('submit');
      await flushPromises();
      expect(find(wrapper, 'button-save-recovery-key').text()).toContain('Saving key pair...');
      expect(find(wrapper, 'button-recovery-back').attributes('disabled')).toBeDefined();

      finishStoring();
      await flushPromises();
    });

    test('does nothing while waiting for the application password', async () => {
      mocks.getPassword.mockReturnValue(false);
      const wrapper = await mountModal();
      await reachStep2(wrapper);

      await save(wrapper);

      expect(mocks.storeKey).not.toHaveBeenCalled();
      expect(wrapper.emitted('update:show')).toBeUndefined();
    });

    describe('a key that already exists at that index', () => {
      test('is not stored again, and the index is marked invalid', async () => {
        const wrapper = await mountModal();
        await reachStep2(wrapper);
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }];
        await find(wrapper, 'input-index').setValue('0');

        await save(wrapper);

        expect(mocks.storeKey).not.toHaveBeenCalled();
        expect(wrapper.find('.invalid-feedback').text()).toBe(
          'Key at index 0 is already restored.',
        );
        expect(wrapper.emitted('update:show')).toBeUndefined();
      });

      test('is logged as a warning', async () => {
        const wrapper = await mountModal();
        await reachStep2(wrapper);
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }];
        await find(wrapper, 'input-index').setValue('0');

        await save(wrapper);

        expect(mocks.logger.warn).toHaveBeenCalledWith('Key already exists at this index', {
          keyType: 'ED25519',
          index: 0,
        });
      });

      test('the warning goes away when another index is entered', async () => {
        const wrapper = await mountModal();
        await reachStep2(wrapper);
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }];
        await find(wrapper, 'input-index').setValue('0');
        await save(wrapper);

        await find(wrapper, 'input-index').setValue('1');

        expect(wrapper.find('.invalid-feedback').exists()).toBe(false);
      });

      test('the same index is fine for the other key type', async () => {
        const wrapper = await mountModal();
        await reachStep2(wrapper);
        mocks.user.keyPairs = [{ public_key: 'ED25519-pub-0' }];
        await selectType(wrapper, 'ECDSA');
        await find(wrapper, 'input-index').setValue('0');

        await save(wrapper);

        expect(mocks.storeKey).toHaveBeenCalled();
      });
    });

    describe('in an organization', () => {
      const organization = { id: 'org-1', userId: 9, userKeys: [] };
      beforeEach(() => {
        mocks.isLoggedInOrganization.mockReturnValue(true);
      });

      test('uploads the public key with its index and phrase hash, and scopes the key to it', async () => {
        const wrapper = await mountModal();
        mocks.user.selectedOrganization = organization;
        await reachStep2(wrapper);
        await selectType(wrapper, 'ECDSA');

        await save(wrapper);

        expect(mocks.safeDuplicateUploadKey).toHaveBeenCalledWith(organization, {
          publicKey: 'ECDSA-pub-0',
          index: 0,
          mnemonicHash: PHRASE_HASH,
        });
        expect(mocks.storeKey).toHaveBeenCalledWith(
          expect.objectContaining({ organization_id: 'org-1', organization_user_id: 9 }),
          PHRASE_HASH,
          'pw',
          false,
        );
      });

      test('stores nothing when the upload fails', async () => {
        mocks.safeDuplicateUploadKey.mockRejectedValue(new Error('server said no'));
        const wrapper = await mountModal();
        mocks.user.selectedOrganization = organization;
        await reachStep2(wrapper);

        await save(wrapper);

        expect(mocks.storeKey).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith('server said no');
      });
    });

    describe('when saving fails', () => {
      test('keeps the modal open and the phrase, and reports the error', async () => {
        mocks.storeKey.mockRejectedValue(new Error('disk full'));
        const wrapper = await mountModal();
        await reachStep2(wrapper);

        await save(wrapper);

        expect(mocks.toastError).toHaveBeenCalledWith('disk full');
        expect(mocks.toastSuccess).not.toHaveBeenCalledWith('Key pair saved');
        expect(wrapper.emitted('update:show')).toBeUndefined();
        expect(mocks.user.recoveryPhrase).not.toBeNull();
        expect(find(wrapper, 'button-save-recovery-key').attributes('disabled')).toBeUndefined();
      });

      test('is logged with the key type, index and error', async () => {
        const failure = new Error('disk full');
        mocks.storeKey.mockRejectedValue(failure);
        const wrapper = await mountModal();
        await reachStep2(wrapper);
        await selectType(wrapper, 'ECDSA');

        await save(wrapper);

        expect(mocks.logger.error).toHaveBeenCalledWith('Failed to save key from recovery phrase', {
          keyType: 'ECDSA',
          index: 0,
          error: failure,
        });
      });
    });
  });

  describe('logging', () => {
    test('logs a saved key by its public key, never by its private key, words or hash', async () => {
      const wrapper = await mountModal();
      await setPhrase();
      await goToStep2(wrapper);
      await selectType(wrapper, 'ECDSA');

      await save(wrapper);

      expect(mocks.logger.info).toHaveBeenCalledWith('Key saved from recovery phrase', {
        keyType: 'ECDSA',
        index: 0,
        publicKey: 'ECDSA-pub-0',
        phraseWasGenerated: false,
        uploadedToOrganization: false,
      });
      const logged = JSON.stringify(Object.values(mocks.logger).flatMap(fn => fn.mock.calls));
      expect(logged).not.toContain('ECDSA-priv-0');
      expect(logged).not.toContain(PHRASE_HASH);
      expect(logged).not.toContain('word1');
    });

    test('records that the phrase was generated here', async () => {
      const wrapper = await mountModal();
      await click(wrapper, 'button-generate-phrase');
      await setPhrase();
      await goToStep2(wrapper);

      await save(wrapper);

      expect(mocks.logger.info).toHaveBeenCalledWith(
        'Key saved from recovery phrase',
        expect.objectContaining({ phraseWasGenerated: true }),
      );
    });
  });

  describe('opening and closing', () => {
    test('the close button asks the parent to hide the modal', async () => {
      const wrapper = await mountModal();

      await wrapper.find('.bi-x-lg').trigger('click');

      expect(wrapper.emitted('update:show')).toEqual([[false]]);
    });

    test('forgets the recovery phrase whenever it is opened or closed', async () => {
      const wrapper = await mountModal();
      await setPhrase();

      await wrapper.setProps({ show: false });
      expect(mocks.user.recoveryPhrase).toBeNull();

      await setPhrase();
      await wrapper.setProps({ show: true });
      expect(mocks.user.recoveryPhrase).toBeNull();
    });

    test('starts again on step 1, without the previous nickname or generated warning', async () => {
      const wrapper = await mountModal();
      await click(wrapper, 'button-generate-phrase');
      await setPhrase();
      await find(wrapper, 'input-recovery-phrase-nickname').setValue('Old');
      await goToStep2(wrapper);

      await wrapper.setProps({ show: false });
      await wrapper.setProps({ show: true });

      expect(step1IsVisible(wrapper)).toBe(true);
      expect(find(wrapper, 'input-index').exists()).toBe(false);
      expect(find(wrapper, 'label-save-recovery-phrase-warning').exists()).toBe(false);
      expect(value(wrapper, 'input-recovery-phrase-nickname')).toBe('');
    });

    test('remembers the last selected key type for the session', async () => {
      const wrapper = await mountModal();
      await setPhrase();
      await goToStep2(wrapper);
      await selectType(wrapper, 'ECDSA');

      await wrapper.setProps({ show: false });
      await wrapper.setProps({ show: true });
      await setPhrase();
      await goToStep2(wrapper);

      expect(typeToggle(wrapper)).toBe('ECDSA');
    });

    test('forgets the last selected key type when the app restarts', async () => {
      const first = await mountModal();
      await setPhrase();
      await goToStep2(first);
      await selectType(first, 'ECDSA');
      first.unmount();

      const afterRestart = await mountModal();
      await setPhrase();
      await goToStep2(afterRestart);

      expect(typeToggle(afterRestart)).toBe('ED25519');
    });
  });
});
