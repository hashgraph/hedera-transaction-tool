// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { KeyList } from '@hiero-ledger/sdk';

import ComplexKeyThreshold from '@renderer/components/ComplexKey/ComplexKeyThreshold.vue';

const mocks = vi.hoisted(() => ({
  userStore: { keyPairs: [] },
  contactsStore: {
    getContactByPublicKey: vi.fn(() => null),
  },
  toastManager: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => mocks.toastManager),
  },
}));

vi.mock('@renderer/utils', () => ({
  isPublicKeyInKeyList: vi.fn(() => false),
}));

vi.mock('@renderer/utils/userStoreHelpers', () => ({
  getNickname: vi.fn(() => null),
}));

const globalStubs = {
  AppButton: { template: '<button data-stub="app-button"><slot /></button>' },
  AppPublicKeyInput: { template: '<div />' },
  ComplexKeyAddPublicKeyModal: { template: '<div />' },
  ComplexKeySelectAccountModal: { template: '<div />' },
};

describe('ComplexKeyThreshold.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountThreshold(props: Record<string, unknown> = {}) {
    return mount(ComplexKeyThreshold, {
      props: {
        keyList: new KeyList([]),
        onRemoveKeyList: vi.fn(),
        ...props,
      },
      global: { stubs: globalStubs },
    });
  }

  describe('label rendering', () => {
    it('shows "Threshold" label when noThreshold is false (default)', () => {
      const wrapper = mountThreshold();
      const label = wrapper.find('p.text-small.text-semi-bold');
      expect(label.text()).toBe('Threshold');
    });

    it('shows "Key list" label when noThreshold is true', () => {
      const wrapper = mountThreshold({ noThreshold: true });
      const label = wrapper.find('p.text-small.text-semi-bold');
      expect(label.text()).toBe('Key list');
    });
  });

  describe('threshold select', () => {
    it('renders the threshold select when noThreshold is false', () => {
      const wrapper = mountThreshold();
      expect(wrapper.find('[data-testid="select-complex-key-threshold-0"]').exists()).toBe(true);
    });

    it('hides the threshold select when noThreshold is true', () => {
      const wrapper = mountThreshold({ noThreshold: true });
      expect(wrapper.find('[data-testid="select-complex-key-threshold-0"]').exists()).toBe(false);
    });
  });

  describe('"Add Threshold" dropdown item', () => {
    it('renders the "Threshold" option in add dropdown when noThreshold is false', () => {
      const wrapper = mountThreshold();
      expect(
        wrapper.find('[data-testid="button-complex-key-add-element-threshold-0"]').exists(),
      ).toBe(true);
    });

    it('hides the "Threshold" option in add dropdown when noThreshold is true', () => {
      const wrapper = mountThreshold({ noThreshold: true });
      expect(
        wrapper.find('[data-testid="button-complex-key-add-element-threshold-0"]').exists(),
      ).toBe(false);
    });
  });

  describe('noThreshold prop propagation to nested thresholds', () => {
    it('passes noThreshold=true to nested ComplexKeyThreshold', async () => {
      // Mount without stub so nested ComplexKeyThreshold is real
      const nestedKeyList = new KeyList([new KeyList([])]);
      const wrapper = mount(ComplexKeyThreshold, {
        props: {
          keyList: nestedKeyList,
          onRemoveKeyList: vi.fn(),
          noThreshold: true,
        },
      });

      // Both root and nested nodes should show "Key list" label, not "Threshold"
      const labels = wrapper.findAll('p.text-small.text-semi-bold');
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach(label => {
        expect(label.text()).toBe('Key list');
      });
    });
  });
});
