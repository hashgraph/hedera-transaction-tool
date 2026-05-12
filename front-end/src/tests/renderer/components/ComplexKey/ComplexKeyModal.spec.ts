// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { KeyList, PrivateKey } from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';
import type { ComplexKey } from '@prisma/client';

import ComplexKeyModal from '@renderer/components/ComplexKey/ComplexKeyModal.vue';

const mocks = vi.hoisted(() => ({
  encodeKey: vi.fn(),
  isKeyListValid: vi.fn(),
}));

vi.mock('@renderer/utils', () => ({
  encodeKey: mocks.encodeKey,
  isKeyListValid: mocks.isKeyListValid,
}));

const realEncodeKey = (k: KeyList) => proto.Key.encode(k._toProtobufKey()).finish();

const realIsKeyListValid = (kl: KeyList): boolean => {
  const keys = kl.toArray();
  if (keys.length === 0) return false;
  if (kl.threshold && kl.threshold > keys.length) return false;
  for (const k of keys) {
    if (k instanceof KeyList && !realIsKeyListValid(k)) return false;
  }
  return true;
};

const globalStubs = {
  AppModal: {
    props: ['show', 'closeOnClickOutside', 'closeOnEscape'],
    template: '<div data-stub="app-modal"><slot /></div>',
  },
  AppButton: {
    props: ['color', 'type', 'disabled'],
    template:
      '<button :data-color="color" :type="type || \'button\'" v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
  AppCustomIcon: { props: ['name'], template: '<div data-stub="app-custom-icon" />' },
  ComplexKey: {
    name: 'ComplexKey',
    props: ['modelKey', 'noThreshold'],
    emits: ['update:model-key'],
    template: '<div data-stub="complex-key" />',
  },
  KeyStructure: {
    props: ['keyList', 'noThreshold'],
    template: '<div data-stub="key-structure" />',
  },
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

const SAVE_BTN = '[data-testid="button-complex-key-save"]';
const DONE_BTN = '[data-testid="button-complex-key-done"]';
const WARN_SPAN = '[data-testid="span-complex-key-already-exists"]';

describe('ComplexKeyModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.encodeKey.mockImplementation(realEncodeKey);
    mocks.isKeyListValid.mockImplementation(realIsKeyListValid);
  });

  function mountModal(props: Record<string, unknown> = {}) {
    return mount(ComplexKeyModal, {
      props: {
        modelKey: null,
        show: true,
        ...props,
      },
      global: { stubs: globalStubs },
    });
  }

  describe('"Save Complex Key" button visibility', () => {
    it('renders when valid multi-key list, no match, callback defined', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);
    });

    it('hides when onSaveComplexKey is undefined (edit-existing flow)', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        savedComplexKeys: [],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });

    it('hides when modelKey is null (currentKeyInvalid)', () => {
      const wrapper = mountModal({
        modelKey: null,
        onSaveComplexKey: vi.fn(),
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });

    it('hides when KeyList contains a single key (isSingleKey)', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1]),
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });

    it('hides when KeyList is empty', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([]),
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });

    it('hides when the current keys match an existing saved complex key', () => {
      const keyList = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: keyList,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(keyList)],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });

    it('remains visible when saved keys exist but none match current keys', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(new KeyList([pk1, pk3]))],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);
    });

    it('hides when KeyList has a threshold higher than its key count (invalid structure)', () => {
      const invalidList = new KeyList([pk1, pk2]);
      invalidList.setThreshold(5);
      const wrapper = mountModal({
        modelKey: invalidList,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [],
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });
  });

  describe('"Complex key already exists" warning span', () => {
    it('renders with the saved key nickname in create mode when there is a match', () => {
      const keyList = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: keyList,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(keyList, { nickname: 'My Saved Key' })],
      });
      const span = wrapper.find(WARN_SPAN);
      expect(span.exists()).toBe(true);
      expect(span.text()).toContain('Complex key already exists');
      expect(span.text()).toContain('"My Saved Key"');
    });

    it('renders without quoted nickname when the saved key has an empty nickname', () => {
      const keyList = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: keyList,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(keyList, { nickname: '' })],
      });
      const span = wrapper.find(WARN_SPAN);
      expect(span.exists()).toBe(true);
      expect(span.text()).toContain('Complex key already exists');
      expect(span.text()).not.toContain('""');
    });

    it('does not render when there is no match', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [],
      });
      expect(wrapper.find(WARN_SPAN).exists()).toBe(false);
    });

    it('does not render in edit mode (onSaveComplexKey undefined) even when a match exists', () => {
      const keyList = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: keyList,
        savedComplexKeys: [makeSavedKey(keyList)],
      });
      expect(wrapper.find(WARN_SPAN).exists()).toBe(false);
    });

    it('does not render when the current key list is invalid', () => {
      const empty = new KeyList([]);
      const wrapper = mountModal({
        modelKey: empty,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(empty)],
      });
      expect(wrapper.find(WARN_SPAN).exists()).toBe(false);
    });
  });

  describe('Done button', () => {
    it('is always rendered regardless of state', () => {
      const wrapper = mountModal({ modelKey: null });
      expect(wrapper.find(DONE_BTN).exists()).toBe(true);
    });

    it('is rendered alongside Save Complex Key when the state is valid', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        onSaveComplexKey: vi.fn(),
      });
      expect(wrapper.find(DONE_BTN).exists()).toBe(true);
      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);
    });
  });

  describe('Save Complex Key click', () => {
    it('emits update:modelKey and invokes onSaveComplexKey when valid', async () => {
      const onSave = vi.fn();
      const keyList = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: keyList,
        onSaveComplexKey: onSave,
        savedComplexKeys: [],
      });

      await wrapper.find(SAVE_BTN).trigger('click');

      expect(onSave).toHaveBeenCalledTimes(1);
      const emitted = wrapper.emitted('update:modelKey');
      expect(emitted).toBeTruthy();
      expect(emitted![0][0]).toStrictEqual(keyList);
    });
  });

  describe('savedComplexKeys prop default', () => {
    it('defaults to an empty array when omitted (Save button shown, warning hidden)', () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        onSaveComplexKey: vi.fn(),
      });
      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);
      expect(wrapper.find(WARN_SPAN).exists()).toBe(false);
    });
  });

  describe('reactivity to inner ComplexKey updates', () => {
    it('hides Save button after the inner key list is updated to match a saved key', async () => {
      const initial = new KeyList([pk1, pk3]);
      const matching = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: initial,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(matching)],
      });

      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);
      expect(wrapper.find(WARN_SPAN).exists()).toBe(false);

      const innerComplexKey = wrapper.findComponent({ name: 'ComplexKey' });
      await innerComplexKey.vm.$emit('update:model-key', matching);

      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
      expect(wrapper.find(WARN_SPAN).exists()).toBe(true);
    });

    it('hides Save button after the inner key list is reduced to a single key', async () => {
      const wrapper = mountModal({
        modelKey: new KeyList([pk1, pk2]),
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [],
      });

      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);

      const innerComplexKey = wrapper.findComponent({ name: 'ComplexKey' });
      await innerComplexKey.vm.$emit('update:model-key', new KeyList([pk1]));

      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
    });

    it('re-shows Save button after a previously matching key list is mutated away from the match', async () => {
      const matching = new KeyList([pk1, pk2]);
      const wrapper = mountModal({
        modelKey: matching,
        onSaveComplexKey: vi.fn(),
        savedComplexKeys: [makeSavedKey(matching)],
      });

      expect(wrapper.find(SAVE_BTN).exists()).toBe(false);
      expect(wrapper.find(WARN_SPAN).exists()).toBe(true);

      const innerComplexKey = wrapper.findComponent({ name: 'ComplexKey' });
      await innerComplexKey.vm.$emit('update:model-key', new KeyList([pk1, pk3]));

      expect(wrapper.find(SAVE_BTN).exists()).toBe(true);
      expect(wrapper.find(WARN_SPAN).exists()).toBe(false);
    });
  });
});
