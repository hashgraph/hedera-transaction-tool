// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import LinkExistingFile from '@renderer/pages/Files/LinkExistingFile/LinkExistingFile.vue';

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  addFile: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    back: mocks.routerBack,
    push: mocks.routerPush,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    personal: { id: 'local-user-id' },
  })),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
  })),
}));

vi.mock('@renderer/composables/useCreateTooltips', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/services/filesService', () => ({
  add: mocks.addFile,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: mocks.toastError,
      success: mocks.toastSuccess,
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  formatAccountId: vi.fn((value: string) => value),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isAccountId: vi.fn((value: string) => /^0\.0\.\d+$/.test(value)),
  isFileId: vi.fn((value: string) => /^0\.0\.\d+$/.test(value)),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    FileId: {
      fromString: vi.fn((value: string) => ({
        toString: vi.fn(() => value),
      })),
    },
  };
});

const stubs = {
  AppButton: {
    props: ['disabled', 'type'],
    template: '<button v-bind="$attrs" :disabled="disabled" :type="type"><slot /></button>',
  },
  AppInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
  },
};

describe('LinkExistingFile.vue', () => {
  beforeEach(() => {
    mocks.routerBack.mockReset();
    mocks.routerPush.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.addFile.mockReset();
  });

  test('renders file id, nickname, and description fields with disabled button for invalid file id', async () => {
    const wrapper = mount(LinkExistingFile, {
      global: {
        stubs,
      },
    });

    expect(wrapper.find('[data-testid="input-existing-file-id"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="input-existing-file-nickname"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="textarea-existing-file-description"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-link-file"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="input-existing-file-id"]').setValue('0.0.2001');

    expect(wrapper.find('[data-testid="button-link-file"]').attributes('disabled')).toBeUndefined();
  });

  test('links a valid file and routes back to files page', async () => {
    const wrapper = mount(LinkExistingFile, {
      global: {
        stubs,
      },
    });

    await wrapper.find('[data-testid="input-existing-file-id"]').setValue('0.0.2001');
    await wrapper.find('[data-testid="input-existing-file-nickname"]').setValue('Linked File');
    await wrapper.find('[data-testid="textarea-existing-file-description"]').setValue('Description');
    await wrapper.find('form').trigger('submit');

    expect(mocks.addFile).toHaveBeenCalledWith({
      description: 'Description',
      file_id: '0.0.2001',
      network: 'testnet',
      nickname: 'Linked File',
      user_id: 'local-user-id',
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('File linked successfully!');
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'files' });
  });

  test('shows link failure toast when the file service rejects', async () => {
    mocks.addFile.mockRejectedValueOnce(new Error('File ID or Nickname already exists!'));
    const wrapper = mount(LinkExistingFile, {
      global: {
        stubs,
      },
    });

    await wrapper.find('[data-testid="input-existing-file-id"]').setValue('0.0.2001');
    await wrapper.find('form').trigger('submit');

    expect(mocks.toastError).toHaveBeenCalledWith('File ID or Nickname already exists!');
  });
});
