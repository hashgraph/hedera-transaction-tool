// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { Key, KeyList, PrivateKey } from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';
import type { ComplexKey } from '@prisma/client';

import KeyField from '@renderer/components/KeyField.vue';

const mocks = vi.hoisted(() => ({
  userPersonal: { id: 'user-1', isLoggedIn: true } as { id: string; isLoggedIn: boolean } | null,
  isUserLoggedIn: vi.fn(),
  getComplexKeys: vi.fn(),
  updateComplexKey: vi.fn(),
  toastManager: { error: vi.fn(), success: vi.fn() },
  appCache: { backendPublicKeyOwner: { get: vi.fn(), set: vi.fn() } },
  encodeKey: vi.fn(),
  isPublicKey: vi.fn(),
  decodeKeyList: vi.fn(),
  formatPublicKey: vi.fn(),
  extractIdentifier: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({ personal: mocks.userPersonal })),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: vi.fn(() => mocks.toastManager) },
}));

vi.mock('@renderer/services/complexKeysService', () => ({
  getComplexKeys: mocks.getComplexKeys,
  updateComplexKey: mocks.updateComplexKey,
}));

vi.mock('@renderer/utils', () => ({
  isPublicKey: mocks.isPublicKey,
  decodeKeyList: mocks.decodeKeyList,
  encodeKey: mocks.encodeKey,
  formatPublicKey: mocks.formatPublicKey,
  extractIdentifier: mocks.extractIdentifier,
}));

vi.mock('@renderer/utils/userStoreHelpers', () => ({
  isUserLoggedIn: mocks.isUserLoggedIn,
}));

vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: { inject: vi.fn(() => mocks.appCache) },
}));

const realEncodeKey = (k: KeyList) => proto.Key.encode(k._toProtobufKey()).finish();

const ComplexKeyModalStub = {
  name: 'ComplexKeyModal',
  props: ['show', 'modelKey', 'onSaveComplexKey', 'noThreshold', 'savedComplexKeys'],
  emits: ['update:show', 'update:modelKey'],
  template: '<div data-testid="complex-key-modal-stub"><slot /></div>',
};

const ComplexKeySaveKeyModalStub = {
  name: 'ComplexKeySaveKeyModal',
  props: ['show', 'keyList', 'onComplexKeySave'],
  emits: ['update:show'],
  template: '<div data-testid="save-key-modal-stub" />',
};

const ComplexKeyAddPublicKeyModalStub = {
  name: 'ComplexKeyAddPublicKeyModal',
  props: ['show'],
  emits: ['update:show', 'selected:single'],
  template: '<div data-testid="add-public-key-modal-stub" />',
};

const ComplexKeySelectSavedKeyStub = {
  name: 'ComplexKeySelectSavedKey',
  props: ['show', 'onKeyListSelect', 'noThreshold'],
  emits: ['update:show'],
  template: '<div data-testid="select-saved-key-stub" />',
};

const AppPublicKeyInputStub = {
  name: 'AppPublicKeyInput',
  props: ['filled', 'label'],
  emits: ['update:model-value'],
  template: '<input data-testid="public-key-input" />',
};

const AppButtonStub = {
  name: 'AppButton',
  props: ['color', 'type', 'size'],
  template: '<button v-bind="$attrs"><slot /></button>',
  inheritAttrs: false,
};

const AppListItemStub = {
  name: 'AppListItem',
  props: ['selected'],
  template: '<div data-testid="key-list-item"><slot /></div>',
};

const globalStubs = {
  AppButton: AppButtonStub,
  AppPublicKeyInput: AppPublicKeyInputStub,
  AppListItem: AppListItemStub,
  ComplexKeyModal: ComplexKeyModalStub,
  ComplexKeyAddPublicKeyModal: ComplexKeyAddPublicKeyModalStub,
  ComplexKeySelectSavedKey: ComplexKeySelectSavedKeyStub,
  ComplexKeySaveKeyModal: ComplexKeySaveKeyModalStub,
};

const pk1 = PrivateKey.generateED25519().publicKey;
const pk2 = PrivateKey.generateED25519().publicKey;
const pk3 = PrivateKey.generateED25519().publicKey;

const makeSavedKey = (keyList: KeyList, overrides: Partial<ComplexKey> = {}): ComplexKey => ({
  id: 'saved-1',
  user_id: 'user-1',
  protobufEncoded: realEncodeKey(keyList).toString(),
  nickname: 'Saved Key',
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

describe('KeyField.vue — complex key pre-fetch and pass-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userPersonal = { id: 'user-1', isLoggedIn: true };
    mocks.isUserLoggedIn.mockImplementation(
      (u: unknown) => !!u && (u as { isLoggedIn?: boolean }).isLoggedIn === true,
    );
    mocks.encodeKey.mockImplementation(realEncodeKey);
    mocks.isPublicKey.mockReturnValue(false);
    mocks.decodeKeyList.mockImplementation((b: string) => {
      const bytes = Uint8Array.from(b.split(',').map(n => Number(n)));
      return Key._fromProtobufKey(proto.Key.decode(bytes));
    });
    mocks.formatPublicKey.mockImplementation(async (raw: string) => raw);
    mocks.extractIdentifier.mockReturnValue({ identifier: 'id' });
    mocks.getComplexKeys.mockResolvedValue([]);
  });

  function mountField(props: Record<string, unknown> = {}) {
    return mount(KeyField, {
      props: { modelKey: null, ...props },
      global: {
        stubs: globalStubs,
        config: { errorHandler: () => {} },
      },
    });
  }

  describe('initial complex key fetch (onMounted)', () => {
    it('loads saved complex keys for the logged-in user on mount', async () => {
      mountField();
      await flushPromises();

      expect(mocks.getComplexKeys).toHaveBeenCalledTimes(1);
      expect(mocks.getComplexKeys).toHaveBeenCalledWith('user-1');
    });

    it('does not call getComplexKeys when the user is not logged in', async () => {
      mocks.isUserLoggedIn.mockReturnValue(false);

      mountField();
      await flushPromises();

      expect(mocks.getComplexKeys).not.toHaveBeenCalled();
    });
  });

  describe('passing savedComplexKeys to ComplexKeyModal', () => {
    it('hands the loaded saved keys to the modal as a prop', async () => {
      const keyList = new KeyList([pk1, pk2]);
      const saved = [makeSavedKey(keyList, { nickname: 'A' })];
      mocks.getComplexKeys.mockResolvedValue(saved);

      const wrapper = mountField({ modelKey: new KeyList([pk1, pk3]) });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      expect(modal.exists()).toBe(true);
      expect(modal.props('savedComplexKeys')).toEqual(saved);
    });

    it('passes an empty array before fetch resolves', async () => {
      mocks.getComplexKeys.mockReturnValue(new Promise(() => {}));

      const wrapper = mountField({ modelKey: new KeyList([pk1, pk2]) });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      expect(modal.exists()).toBe(true);
      expect(modal.props('savedComplexKeys')).toEqual([]);
    });
  });

  describe('synchronous match lookup', () => {
    it('sets selectedComplexKey to the matching saved record when modelKey matches', async () => {
      const matching = new KeyList([pk1, pk2]);
      const saved = makeSavedKey(matching, { nickname: 'Matched Key' });
      mocks.getComplexKeys.mockResolvedValue([saved]);

      const wrapper = mountField({ modelKey: matching });
      await flushPromises();

      const listItem = wrapper.find('[data-testid="key-list-item"]');
      expect(listItem.exists()).toBe(true);
      expect(listItem.text()).toContain('Matched Key');
      expect(listItem.text()).not.toContain('Unsaved Key List');
    });

    it('leaves selectedComplexKey null when no saved record matches the modelKey', async () => {
      const modelKey = new KeyList([pk1, pk2]);
      const otherSaved = makeSavedKey(new KeyList([pk1, pk3]), { nickname: 'Other' });
      mocks.getComplexKeys.mockResolvedValue([otherSaved]);

      const wrapper = mountField({ modelKey });
      await flushPromises();

      const listItem = wrapper.find('[data-testid="key-list-item"]');
      expect(listItem.exists()).toBe(true);
      expect(listItem.text()).toContain('Unsaved Key List');
      expect(listItem.text()).not.toContain('Other');
    });
  });

  describe('refresh after handleSaveKeyList', () => {
    it('re-fetches saved complex keys after a new complex key is saved', async () => {
      const matching = new KeyList([pk1, pk2]);
      const afterSave = [makeSavedKey(matching, { id: 'new', nickname: 'Just Saved' })];

      mocks.getComplexKeys.mockResolvedValueOnce([]);
      mocks.getComplexKeys.mockResolvedValueOnce(afterSave);

      const wrapper = mountField({ modelKey: matching });
      await flushPromises();

      expect(mocks.getComplexKeys).toHaveBeenCalledTimes(1);

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      const onSaveComplexKey = modal.props('onSaveComplexKey') as (() => void) | undefined;
      expect(onSaveComplexKey).toBeTypeOf('function');
      onSaveComplexKey?.();
      await flushPromises();

      const saveModal = wrapper.findComponent(ComplexKeySaveKeyModalStub);
      expect(saveModal.exists()).toBe(true);
      const onComplexKeySave = saveModal.props('onComplexKeySave') as
        | ((k: ComplexKey) => Promise<void>)
        | undefined;
      expect(onComplexKeySave).toBeTypeOf('function');
      await onComplexKeySave?.(afterSave[0]);
      await flushPromises();

      expect(mocks.getComplexKeys).toHaveBeenCalledTimes(2);
      expect(modal.props('savedComplexKeys')).toEqual(afterSave);
    });
  });

  describe('onSaveComplexKey wiring (selectedComplexKey gate)', () => {
    it('passes onSaveComplexKey when no saved key matches (create-new flow)', async () => {
      mocks.getComplexKeys.mockResolvedValue([]);

      const wrapper = mountField({ modelKey: new KeyList([pk1, pk2]) });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      expect(modal.props('onSaveComplexKey')).toBeTypeOf('function');
    });

    it('omits onSaveComplexKey when an existing saved key matches (edit-existing flow)', async () => {
      const matching = new KeyList([pk1, pk2]);
      mocks.getComplexKeys.mockResolvedValue([makeSavedKey(matching)]);

      const wrapper = mountField({ modelKey: matching });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      expect(modal.props('onSaveComplexKey')).toBeUndefined();
    });
  });

  describe('handleComplexKeyUpdate (in-place edit of a saved complex key)', () => {
    it('calls updateComplexKey, refreshes the cache row, and shows a success toast', async () => {
      const original = new KeyList([pk1, pk2]);
      const edited = new KeyList([pk1, pk3]);
      const savedOriginal = makeSavedKey(original, { id: 'saved-1', nickname: 'Edited Key' });
      mocks.getComplexKeys.mockResolvedValue([savedOriginal]);

      const editedSaved: ComplexKey = {
        ...savedOriginal,
        protobufEncoded: realEncodeKey(edited).toString(),
      };
      mocks.updateComplexKey.mockResolvedValueOnce(editedSaved);

      const wrapper = mountField({ modelKey: original });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      modal.vm.$emit('update:modelKey', edited);
      await wrapper.setProps({ modelKey: edited });
      await flushPromises();

      expect(mocks.updateComplexKey).toHaveBeenCalledTimes(1);
      expect(mocks.updateComplexKey).toHaveBeenCalledWith(
        'saved-1',
        expect.any(Uint8Array),
      );
      expect(modal.props('savedComplexKeys')).toEqual([editedSaved]);
      expect(mocks.toastManager.success).toHaveBeenCalledWith('Key list updated successfully');
      expect(mocks.toastManager.error).not.toHaveBeenCalled();
    });

    it('reverts the cache and shows an error toast when updateComplexKey rejects', async () => {
      const original = new KeyList([pk1, pk2]);
      const edited = new KeyList([pk1, pk3]);
      const savedOriginal = makeSavedKey(original, { id: 'saved-1', nickname: 'Edited Key' });
      mocks.getComplexKeys.mockResolvedValue([savedOriginal]);
      mocks.updateComplexKey.mockRejectedValueOnce(new Error('Complex key not found!'));

      const wrapper = mountField({ modelKey: original });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      modal.vm.$emit('update:modelKey', edited);
      await wrapper.setProps({ modelKey: edited });
      await flushPromises();

      expect(mocks.updateComplexKey).toHaveBeenCalledTimes(1);
      expect(modal.props('savedComplexKeys')).toEqual([savedOriginal]);
      expect(mocks.toastManager.error).toHaveBeenCalledWith('Complex key not found!');
      expect(mocks.toastManager.success).not.toHaveBeenCalled();

      const listItem = wrapper.find('[data-testid="key-list-item"]');
      expect(listItem.exists()).toBe(true);
      expect(listItem.text()).toContain('Edited Key');
      expect(listItem.text()).not.toContain('Unsaved Key List');
    });

    it('ignores concurrent handleComplexKeyUpdate calls while one is in flight', async () => {
      const original = new KeyList([pk1, pk2]);
      const edited1 = new KeyList([pk1, pk3]);
      const edited2 = new KeyList([pk2, pk3]);
      const savedOriginal = makeSavedKey(original, { id: 'saved-1' });
      mocks.getComplexKeys.mockResolvedValue([savedOriginal]);
      mocks.updateComplexKey.mockReturnValue(new Promise(() => {}));

      const wrapper = mountField({ modelKey: original });
      await flushPromises();

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      modal.vm.$emit('update:modelKey', edited1);
      await wrapper.setProps({ modelKey: edited1 });
      await flushPromises();

      expect(mocks.updateComplexKey).toHaveBeenCalledTimes(1);

      modal.vm.$emit('update:modelKey', edited2);
      await wrapper.setProps({ modelKey: edited2 });
      await flushPromises();

      expect(mocks.updateComplexKey).toHaveBeenCalledTimes(1);
    });

    it('preserves selectedComplexKey while updateComplexKey is pending (optimistic cache write)', async () => {
      const original = new KeyList([pk1, pk2]);
      const edited = new KeyList([pk1, pk3]);
      const savedOriginal = makeSavedKey(original, { id: 'saved-1', nickname: 'Pending Edit' });
      mocks.getComplexKeys.mockResolvedValue([savedOriginal]);
      mocks.updateComplexKey.mockReturnValueOnce(new Promise(() => {}));

      const wrapper = mountField({ modelKey: original });
      await flushPromises();

      expect(wrapper.find('[data-testid="key-list-item"]').text()).toContain('Pending Edit');

      const modal = wrapper.findComponent(ComplexKeyModalStub);
      modal.vm.$emit('update:modelKey', edited);
      await wrapper.setProps({ modelKey: edited });
      await flushPromises();

      const listItem = wrapper.find('[data-testid="key-list-item"]');
      expect(listItem.text()).toContain('Pending Edit');
      expect(listItem.text()).not.toContain('Unsaved Key List');
    });
  });
});
