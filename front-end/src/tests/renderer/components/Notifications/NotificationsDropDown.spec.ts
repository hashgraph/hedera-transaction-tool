// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import NotificationsDropDown from '@renderer/components/Notifications/NotificationsDropDown.vue';

const pendingNetworkHost = ref<string | null>(null);
const confirmNetwork = vi.fn();
const cancelNetwork = vi.fn();

vi.mock('@renderer/components/Notifications/composables', () => ({
  useGroupedNotifications: () => ({
    groupedNotifications: ref({}),
    totalCount: ref(0),
    pendingNetworkHost,
    confirmNetwork,
    cancelNetwork,
  }),
}));
vi.mock('@renderer/services/electronUtilsService', () => ({ setDockBounce: vi.fn() }));

const ConfirmStub = {
  name: 'AppConfirmModal',
  props: ['show', 'text', 'callback', 'cancel'],
  template: '<div class="confirm" v-if="show">{{ text }}</div>',
};

const mountDropDown = () =>
  mount(NotificationsDropDown, { global: { stubs: { AppConfirmModal: ConfirmStub } } });

describe('NotificationsDropDown network confirmation', () => {
  it('shows no dialog by default', () => {
    pendingNetworkHost.value = null;
    expect(mountDropDown().find('.confirm').exists()).toBe(false);
  });

  it('shows the dialog naming the host when a switch is pending', async () => {
    pendingNetworkHost.value = null;
    const wrapper = mountDropDown();
    pendingNetworkHost.value = 'mirror.example.com';
    await nextTick();
    expect(wrapper.find('.confirm').text()).toContain('mirror.example.com');
  });

  it('wires confirm and cancel to the composable', () => {
    const modal = mountDropDown().findComponent({ name: 'AppConfirmModal' });
    expect(modal.props('callback')).toBe(confirmNetwork);
    expect(modal.props('cancel')).toBe(cancelNetwork);
  });
});
