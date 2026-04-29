// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import PublicKeysTab from '@renderer/pages/Settings/components/PublicKeysTab/PublicKeysTab.vue';
import ImportPublicKeyModal from '@renderer/components/ImportPublicKeyModal.vue';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  clipboardWriteText: vi.fn(),
  publicKeyFromString: vi.fn(),
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: null as any,
    publicKeyMappings: [] as any[],
    refetchPublicKeys: vi.fn(),
    storePublicKeyMapping: vi.fn(),
    updatePublicKeyMappingNickname: vi.fn(),
    deletePublicKeyMapping: vi.fn(),
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/caches/backend/PublicKeyOwnerCache', () => {
  class PublicKeyOwnerCache {
    static inject = vi.fn(() => ({
      lookup: vi.fn(async () => null),
    }));

    lookup = vi.fn(async () => null);
  }

  return {
    PublicKeyOwnerCache,
  };
});

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: mocks.toastError,
      success: mocks.toastSuccess,
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    PublicKey: {
      fromString: mocks.publicKeyFromString,
    },
  };
});

const stubs = {
  AppButton: {
    props: ['disabled', 'type'],
    template: '<button v-bind="$attrs" :disabled="disabled" :type="type"><slot /></button>',
  },
  AppCheckBox: {
    props: ['checked', 'disabled'],
    template:
      '<input v-bind="$attrs" type="checkbox" :checked="checked" :disabled="disabled" @change="$emit(\'update:checked\', $event.target.checked)" />',
  },
  AppCustomIcon: {
    template: '<div />',
  },
  AppInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  AppModal: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
};

describe('settings public keys coverage', () => {
  beforeEach(() => {
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.clipboardWriteText.mockReset();
    mocks.publicKeyFromString.mockReset();
    mocks.publicKeyFromString.mockImplementation((value: string) => {
      if (value.startsWith('invalid')) throw new Error('invalid key');
      return {};
    });
    mocks.userStore.selectedOrganization = null;
    mocks.userStore.publicKeyMappings = [
      {
        id: 'mapping-1',
        nickname: 'Key One',
        public_key: 'valid-public-key-one',
      },
      {
        id: 'mapping-2',
        nickname: 'Key Two',
        public_key: 'valid-public-key-two',
      },
    ];
    mocks.userStore.refetchPublicKeys.mockReset();
    mocks.userStore.storePublicKeyMapping.mockReset();
    mocks.userStore.updatePublicKeyMappingNickname.mockReset();
    mocks.userStore.deletePublicKeyMapping.mockReset();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mocks.clipboardWriteText,
      },
    });
  });

  test('renders public key mappings table and copies a public key', async () => {
    const wrapper = mount(PublicKeysTab, {
      global: {
        stubs,
      },
    });
    await flushPromises();

    const headerText = wrapper.find('thead').text();
    expect(headerText).toContain('Nickname');
    expect(headerText).toContain('Owner');
    expect(headerText).toContain('Public Key');
    expect(wrapper.find('[data-testid="cell-public-nickname-0"]').text()).toContain('Key One');
    expect(wrapper.find('[data-testid="span-public-key-0"]').text()).toBe('valid-public-key-one');

    await wrapper.find('[data-testid="span-copy-public-key-0"]').trigger('click');

    expect(mocks.clipboardWriteText).toHaveBeenCalledWith('valid-public-key-one');
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Public Key copied successfully');
  });

  test('renames a public key mapping from the row action', async () => {
    const wrapper = mount(PublicKeysTab, {
      global: {
        stubs,
      },
    });
    await flushPromises();

    await wrapper.find('[data-testid="button-change-key-nickname"]').trigger('click');
    await wrapper.find('[data-testid="input-public-key-nickname"]').setValue('Renamed Key');
    await wrapper.find('[data-testid="button-confirm-update-nickname"]').trigger('submit');
    await flushPromises();

    expect(mocks.userStore.updatePublicKeyMappingNickname).toHaveBeenCalledWith(
      'mapping-1',
      'valid-public-key-one',
      'Renamed Key',
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Nickname updated successfully');
  });

  test('selects public keys and deletes them in bulk', async () => {
    const wrapper = mount(PublicKeysTab, {
      global: {
        stubs,
      },
    });
    await flushPromises();

    await wrapper.find('[data-testid="checkbox-select-all-public-keys"]').setValue(true);
    await wrapper.find('[data-testid="button-delete-public-all"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.userStore.deletePublicKeyMapping).toHaveBeenCalledWith('mapping-1');
    expect(mocks.userStore.deletePublicKeyMapping).toHaveBeenCalledWith('mapping-2');
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Public key mapping(s) deleted successfully',
    );
  });

  test('deletes a public key mapping from the row action', async () => {
    const wrapper = mount(PublicKeysTab, {
      global: {
        stubs,
      },
    });
    await flushPromises();

    await wrapper.find('[data-testid="button-delete-key-0"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.userStore.deletePublicKeyMapping).toHaveBeenCalledWith('mapping-1');
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Public key mapping(s) deleted successfully',
    );
  });

  test('imports public key mappings and validates disabled and invalid states', async () => {
    const wrapper = mount(ImportPublicKeyModal, {
      props: {
        show: true,
      },
      global: {
        stubs,
      },
    });

    expect(wrapper.find('[data-testid="button-public-key-import"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="input-public-key-mapping"]').setValue('invalid-key');
    await wrapper.find('[data-testid="input-public-key-nickname"]').setValue('Bad Key');
    expect(wrapper.find('[data-testid="button-public-key-import"]').attributes('disabled')).toBeUndefined();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Invalid public key! Please enter a valid Hedera public key.',
    );
    expect(mocks.userStore.storePublicKeyMapping).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="input-public-key-mapping"]').setValue('valid-public-key');
    await wrapper.find('[data-testid="input-public-key-nickname"]').setValue('Good Key');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.userStore.storePublicKeyMapping).toHaveBeenCalledWith(
      'valid-public-key',
      'Good Key',
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Public key and nickname imported successfully',
    );
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
  });
});
