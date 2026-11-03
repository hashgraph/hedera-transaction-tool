// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import KeychainUnavailableModal from '@renderer/components/GlobalAppProcesses/components/KeychainUnavailableModal.vue';

const mocks = vi.hoisted(() => ({
  store: { keychainUnavailable: false },
  relaunch: vi.fn(),
}));

vi.mock('@renderer/stores/storeSafeStorage', () => ({
  default: vi.fn(() => mocks.store),
}));

vi.mock('@renderer/services/electronUtilsService', () => ({
  relaunch: mocks.relaunch,
}));

const ResetDataModalStub = {
  name: 'ResetDataModal',
  props: ['show'],
  emits: ['update:show', 'data:reset'],
  template: '<div data-testid="reset-stub" :data-show="show"></div>',
};

const mountModal = () =>
  mount(KeychainUnavailableModal, {
    global: { stubs: { ResetDataModal: ResetDataModalStub }, renderStubDefaultSlot: true },
    attachTo: document.body,
  });

describe('KeychainUnavailableModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
    mocks.store = reactive({ keychainUnavailable: false });
  });

  test('renders nothing when the keychain is available', () => {
    mountModal();
    expect(document.body.textContent).not.toContain('Keychain access required');
  });

  test('shows the modal when the keychain is unavailable', () => {
    mocks.store.keychainUnavailable = true;
    mountModal();

    expect(document.body.textContent).toContain('Keychain access required');
  });

  test('relaunch button relaunches the app', async () => {
    mocks.store.keychainUnavailable = true;
    mountModal();

    document
      .querySelector<HTMLButtonElement>('[data-testid="button-keychain-unavailable-relaunch"]')
      ?.click();

    expect(mocks.relaunch).toHaveBeenCalled();
  });

  test('reset button opens the reset confirmation, and a completed reset relaunches the app', async () => {
    mocks.store.keychainUnavailable = true;
    const wrapper = mountModal();

    document.querySelector<HTMLButtonElement>('[data-testid="button-keychain-unavailable-reset"]')?.click();
    await flushPromises();

    const reset = wrapper.findComponent({ name: 'ResetDataModal' });
    expect(reset.props('show')).toBe(true);
    expect(mocks.relaunch).not.toHaveBeenCalled();

    reset.vm.$emit('data:reset');
    await flushPromises();

    expect(mocks.relaunch).toHaveBeenCalled();
  });
});
