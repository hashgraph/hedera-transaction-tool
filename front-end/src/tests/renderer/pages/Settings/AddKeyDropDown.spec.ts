// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  processEncrypted: vi.fn(),
  modalStub: (testid: string) => ({
    props: ['show', 'keyType', 'publicKey'],
    emits: ['update:show'],
    template: `<div data-testid="${testid}" :data-show="String(show)" :data-key-type="String(keyType)"><button data-testid="${testid}-close" @click="$emit('update:show', false)" /></div>`,
  }),
}));

vi.mock('@renderer/components/GenerateKeyModal.vue', () => ({
  default: mocks.modalStub('generate-key-modal'),
}));
vi.mock('@renderer/components/RecoveryPhraseKeyModal.vue', () => ({
  default: mocks.modalStub('recovery-phrase-modal'),
}));
vi.mock('@renderer/components/ImportExternalPrivateKeyModal.vue', () => ({
  default: mocks.modalStub('import-private-key-modal'),
}));
vi.mock('@renderer/components/KeyPair/ImportEncrypted', () => ({
  default: {
    setup(_: unknown, { expose }: { expose: (exposed: object) => void }) {
      expose({ process: mocks.processEncrypted });
      return () => null;
    },
  },
}));

import AddKeyDropDown from '@renderer/pages/Settings/components/AddKeyDropDown.vue';

function mountDropDown() {
  return mount(AddKeyDropDown, {
    global: { stubs: { AppButton: { template: '<button v-bind="$attrs"><slot /></button>' } } },
  });
}

type Wrapper = ReturnType<typeof mountDropDown>;
const find = (wrapper: Wrapper, testid: string) => wrapper.find(`[data-testid="${testid}"]`);
const isShown = (wrapper: Wrapper, modal: string) =>
  find(wrapper, modal).attributes('data-show') === 'true';

describe('AddKeyDropDown.vue', () => {
  beforeEach(() => {
    mocks.processEncrypted.mockReset();
  });

  describe('menu', () => {
    test('is a single Add Key button', () => {
      const wrapper = mountDropDown();

      expect(find(wrapper, 'button-add-key-dropdown').text()).toContain('Add Key');
    });

    test('offers Generate, Recovery Phrase, Import Private Key and Import Encrypted Keys, in that order', () => {
      const wrapper = mountDropDown();

      const items = wrapper.findAll('.dropdown-item');

      expect(items.map(i => i.attributes('data-testid'))).toEqual([
        'link-generate-key',
        'link-recovery-phrase',
        'link-import-private-key',
        'link-import-encrypted-key',
      ]);
      expect(items.map(i => i.text())).toEqual([
        'Generate',
        'Recovery Phrase',
        'Import Private Key',
        'Import Encrypted Keys',
      ]);
    });

    test('no longer has separate items per key type', () => {
      const wrapper = mountDropDown();

      expect(find(wrapper, 'link-import-ed25519-key').exists()).toBe(false);
      expect(find(wrapper, 'link-import-ecdsa-key').exists()).toBe(false);
      expect(find(wrapper, 'link-import-mnemonic').exists()).toBe(false);
    });
  });

  describe('opening the modals', () => {
    test('all modals start closed', () => {
      const wrapper = mountDropDown();

      expect(isShown(wrapper, 'generate-key-modal')).toBe(false);
      expect(isShown(wrapper, 'recovery-phrase-modal')).toBe(false);
      expect(isShown(wrapper, 'import-private-key-modal')).toBe(false);
    });

    test('Generate opens the generate key modal only', async () => {
      const wrapper = mountDropDown();

      await find(wrapper, 'link-generate-key').trigger('click');

      expect(isShown(wrapper, 'generate-key-modal')).toBe(true);
      expect(isShown(wrapper, 'recovery-phrase-modal')).toBe(false);
      expect(isShown(wrapper, 'import-private-key-modal')).toBe(false);
    });

    test('Recovery Phrase opens the recovery phrase modal only', async () => {
      const wrapper = mountDropDown();

      await find(wrapper, 'link-recovery-phrase').trigger('click');

      expect(isShown(wrapper, 'recovery-phrase-modal')).toBe(true);
      expect(isShown(wrapper, 'generate-key-modal')).toBe(false);
      expect(isShown(wrapper, 'import-private-key-modal')).toBe(false);
    });

    test('Import Private Key opens the import modal only', async () => {
      const wrapper = mountDropDown();

      await find(wrapper, 'link-import-private-key').trigger('click');

      expect(isShown(wrapper, 'import-private-key-modal')).toBe(true);
      expect(isShown(wrapper, 'generate-key-modal')).toBe(false);
      expect(isShown(wrapper, 'recovery-phrase-modal')).toBe(false);
    });

    test('Import Private Key does not fix the key type, so the user can choose it', async () => {
      const wrapper = mountDropDown();

      await find(wrapper, 'link-import-private-key').trigger('click');

      expect(find(wrapper, 'import-private-key-modal').attributes('data-key-type')).toBe(
        'undefined',
      );
    });

    test('Import Encrypted Keys starts the encrypted keys import, without opening a modal here', async () => {
      const wrapper = mountDropDown();

      await find(wrapper, 'link-import-encrypted-key').trigger('click');

      expect(mocks.processEncrypted).toHaveBeenCalledTimes(1);
      expect(isShown(wrapper, 'generate-key-modal')).toBe(false);
      expect(isShown(wrapper, 'recovery-phrase-modal')).toBe(false);
      expect(isShown(wrapper, 'import-private-key-modal')).toBe(false);
    });
  });

  describe('closing the modals', () => {
    test.each([
      ['link-generate-key', 'generate-key-modal'],
      ['link-recovery-phrase', 'recovery-phrase-modal'],
      ['link-import-private-key', 'import-private-key-modal'],
    ])('%s: the modal can be closed and opened again', async (link, modal) => {
      const wrapper = mountDropDown();
      await find(wrapper, link).trigger('click');
      expect(isShown(wrapper, modal)).toBe(true);

      await find(wrapper, `${modal}-close`).trigger('click');
      expect(isShown(wrapper, modal)).toBe(false);

      await find(wrapper, link).trigger('click');
      expect(isShown(wrapper, modal)).toBe(true);
    });
  });
});
