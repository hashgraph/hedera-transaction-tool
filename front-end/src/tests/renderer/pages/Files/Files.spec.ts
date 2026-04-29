// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';

import Files from '@renderer/pages/Files/Files.vue';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  toastSuccess: vi.fn(),
  getAllFiles: vi.fn(),
  removeFiles: vi.fn(),
  updateFile: vi.fn(),
  showStoredFileInTemp: vi.fn(),
  fileInfo: {
    expirationTime: '2026-12-31T00:00:00.000Z',
    fileMemo: 'file memo',
    isDeleted: false,
    keys: ['file-key'],
    ledgerId: 'testnet',
    size: { toNumber: () => 12 },
  },
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
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
    client: {},
    network: 'testnet',
  })),
}));

vi.mock('@renderer/composables/useCreateTooltips', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/services/filesService', () => ({
  getAll: mocks.getAllFiles,
  remove: mocks.removeFiles,
  showStoredFileInTemp: mocks.showStoredFileInTemp,
  update: mocks.updateFile,
}));

vi.mock('@renderer/services/keyPairService', () => ({
  flattenKeyList: vi.fn(() => [
    {
      _key: { _type: 'ED25519' },
      toStringRaw: () => 'file-public-key',
    },
  ]),
  getKeyListLevels: vi.fn(() => 2),
}));

vi.mock('@renderer/components/Transaction/Create/txTypeComponentMapping', () => ({
  transactionTypeKeys: {
    appendToFile: 'FileAppendTransaction',
    createFile: 'FileCreateTransaction',
    readFile: 'FileContentsQuery',
    updateFile: 'FileUpdateTransaction',
  },
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      success: mocks.toastSuccess,
    })),
  },
}));

vi.mock('@renderer/utils', () => ({
  convertBytes: vi.fn(() => '12 B'),
  getUInt8ArrayFromBytesString: vi.fn((value: string) =>
    value ? new TextEncoder().encode(value) : new Uint8Array(),
  ),
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
}));

vi.mock('@renderer/utils/transactions', () => ({
  getFormattedDateFromTimestamp: vi.fn(() => 'Dec 31, 2026'),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    Client: class Client {},
    FileId: {
      fromString: vi.fn((value: string) => ({
        toStringWithChecksum: vi.fn(() => `${value}-abcde`),
      })),
    },
    FileInfo: {
      fromBytes: vi.fn(() => mocks.fileInfo),
    },
  };
});

const AppInputStub = defineComponent({
  emits: ['blur'],
  setup(_props, { emit, expose }) {
    const inputRef = ref<HTMLInputElement | null>(null);
    expose({ inputRef });
    return { emit, inputRef };
  },
  template: '<input ref="inputRef" v-bind="$attrs" @blur="emit(\'blur\', $event)" />',
});

const stubs = {
  AppButton: {
    props: ['disabled'],
    template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
  },
  AppCheckBox: {
    props: ['checked'],
    template:
      '<input v-bind="$attrs" type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
  },
  AppCustomIcon: {
    template: '<div />',
  },
  AppInput: AppInputStub,
  AppModal: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
  KeyStructureModal: {
    props: ['show'],
    template: '<div v-if="show" data-testid="key-structure-modal" />',
  },
  Transition: false,
};

const files = [
  {
    contentBytes: 'hello',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    description: 'file description',
    file_id: '0.0.2001',
    lastRefreshed: new Date('2026-01-02T00:00:00.000Z'),
    metaBytes: 'meta',
    nickname: 'Primary File',
  },
  {
    contentBytes: '',
    created_at: new Date('2026-01-02T00:00:00.000Z'),
    description: 'second description',
    file_id: '0.0.2002',
    lastRefreshed: null,
    metaBytes: 'meta',
    nickname: 'Secondary File',
  },
];

describe('Files.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.getAllFiles.mockReset();
    mocks.getAllFiles.mockResolvedValue(files);
    mocks.removeFiles.mockReset();
    mocks.updateFile.mockReset();
    mocks.showStoredFileInTemp.mockReset();
    mocks.fileInfo.isDeleted = false;
  });

  function mountFiles() {
    return mount(Files, {
      global: {
        mocks: {
          $router: {
            push: mocks.routerPush,
          },
        },
        stubs,
      },
    });
  }

  test('renders files, add-new routes, and file details', async () => {
    const wrapper = mountFiles();
    await flushPromises();

    expect(wrapper.find('[data-testid="p-file-nickname-0"]').text()).toBe('Primary File');
    expect(wrapper.find('[data-testid="p-file-id-0"]').text()).toBe('0.0.2001');
    expect(wrapper.find('[data-testid="link-create-new-file"]').text()).toBe('Create New');
    expect(wrapper.find('[data-testid="link-update-file"]').text()).toBe('Update');
    expect(wrapper.find('[data-testid="link-append-file"]').text()).toBe('Append');
    expect(wrapper.find('[data-testid="link-read-file"]').text()).toBe('Read');
    expect(wrapper.find('[data-testid="link-add-existing-file"]').text()).toBe('Add Existing');
    expect(wrapper.find('[data-testid="p-file-id-info"]').text()).toContain('0.0.2001');
    expect(wrapper.find('[data-testid="p-file-size"]').text()).toBe('12 B');
    expect(wrapper.find('[data-testid="p-file-key"]').text()).toBe('file-public-key');
    expect(wrapper.find('[data-testid="p-file-memo"]').text()).toBe('file memo');
    expect(wrapper.find('[data-testid="p-file-ledger-id"]').text()).toBe('testnet');
    expect(wrapper.find('[data-testid="p-file-expires-at"]').text()).toBe('Dec 31, 2026');
    expect(wrapper.find('[data-testid="p-file-description"]').text()).toContain('file description');
    expect(wrapper.find('[data-testid="textarea-file-content"]').element).toBeTruthy();

    await wrapper.find('[data-testid="link-create-new-file"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'FileCreateTransaction' },
    });
    await wrapper.find('[data-testid="link-add-existing-file"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith('files/link-existing');
  });

  test('sort menu refetches files with selected sort order', async () => {
    const wrapper = mountFiles();
    await flushPromises();

    await wrapper.find('[data-testid="menu-sort-file-id-asc"]').trigger('click');
    await flushPromises();
    expect(mocks.getAllFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { file_id: 'asc' } }),
    );

    await wrapper.find('[data-testid="menu-sort-file-nickname-desc"]').trigger('click');
    await flushPromises();
    expect(mocks.getAllFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { nickname: 'desc' } }),
    );

    await wrapper.find('[data-testid="menu-sort-file-date-added-asc"]').trigger('click');
    await flushPromises();
    expect(mocks.getAllFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: { created_at: 'asc' } }),
    );
  });

  test('select mode shows checkboxes and opens unlink modal for selected files', async () => {
    const wrapper = mountFiles();
    await flushPromises();

    await wrapper.find('[data-testid="button-select-many-files"]').trigger('click');

    expect(wrapper.find('[data-testid="checkbox-multiple-file-id-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-remove-multiple-files"]').attributes('disabled')).toBeDefined();

    await wrapper.find('[data-testid="checkbox-multiple-file-id-0"]').setValue(true);
    expect(wrapper.find('[data-testid="button-remove-multiple-files"]').attributes('disabled')).toBeUndefined();

    await wrapper.find('[data-testid="button-remove-multiple-files"]').trigger('click');
    expect(wrapper.find('[data-testid="button-confirm-unlink-file"]').exists()).toBe(true);
  });

  test('routes file actions and opens remove confirmation', async () => {
    const wrapper = mountFiles();
    await flushPromises();

    await wrapper.find('[data-testid="button-update-file"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'FileUpdateTransaction' },
      query: { fileId: '0.0.2001' },
    });

    await wrapper.find('[data-testid="button-append-file"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'FileAppendTransaction' },
      query: { fileId: '0.0.2001' },
    });

    await wrapper.find('[data-testid="button-read-file"]').trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createTransaction',
      params: { type: 'FileContentsQuery' },
      query: { fileId: '0.0.2001' },
    });

    await wrapper.find('[data-testid="button-remove-file-card"]').trigger('click');
    expect(wrapper.find('[data-testid="button-confirm-unlink-file"]').exists()).toBe(true);
  });

  test('edits file nickname and description and shows deleted warning', async () => {
    mocks.fileInfo.isDeleted = true;
    const wrapper = mountFiles();
    await flushPromises();

    expect(wrapper.find('[data-testid="p-file-is-deleted"]').text()).toBe('File is deleted');

    await wrapper.find('[data-testid="span-edit-file-nickname"]').trigger('click');
    await flushPromises();
    const nicknameInput = wrapper.find('[data-testid="input-file-nickname"]');
    expect(nicknameInput.exists()).toBe(true);
    (nicknameInput.element as HTMLInputElement).value = 'Renamed File';
    await nicknameInput.trigger('blur');
    await flushPromises();

    expect(mocks.updateFile).toHaveBeenCalledWith('0.0.2001', 'local-user-id', {
      nickname: 'Renamed File',
    });

    await wrapper.find('[data-testid="span-edit-file-description"]').trigger('click');
    await flushPromises();
    const descriptionInput = wrapper.find('[data-testid="textarea-file-description"]');
    expect(descriptionInput.exists()).toBe(true);
    await descriptionInput.setValue('Updated description');
    await descriptionInput.trigger('blur');
    await flushPromises();

    expect(mocks.updateFile).toHaveBeenCalledWith('0.0.2001', 'local-user-id', {
      description: 'Updated description',
    });
  });
});
