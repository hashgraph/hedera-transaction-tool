// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getGroupStatus: vi.fn(),
  getGroup: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({
    selectedOrganization: { serverUrl: 'https://org.test', userKeys: [{ id: 1, publicKey: 'pk' }] },
  }),
}));
vi.mock('@renderer/services/organization', () => ({ getTransactionGroupById: mocks.getGroup }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertIsLoggedInOrganization: vi.fn(),
  getGroupCreatorSignatureStatus: mocks.getGroupStatus,
}));

import SignGroupButton from '@renderer/pages/Transactions/components/SignGroupButton.vue';

const group = { id: 3, groupItems: [] };

function render() {
  return mount(SignGroupButton, {
    props: { groupId: 3 },
    global: {
      stubs: {
        AppButton: { template: '<button @click="$emit(\'click\', $event)"><slot /></button>' },
        SignAllController: {
          props: ['activate', 'groupOrId'],
          template:
            '<div data-testid="controller" :data-active="String(activate)" :data-group="typeof groupOrId" />',
        },
        CreatorSignatureConfirmModal: {
          props: { show: Boolean, status: String, group: Boolean, callback: Function },
          template:
            '<div data-testid="confirm" :data-show="String(show)" :data-status="status" :data-group="String(group)" @click="callback()" />',
        },
      },
    },
  });
}

describe('SignGroupButton.vue', () => {
  beforeEach(() => {
    mocks.getGroup.mockReset().mockResolvedValue(group);
    mocks.getGroupStatus.mockReset();
  });

  test('starts signing directly, passing the fetched group, when verified', async () => {
    mocks.getGroupStatus.mockReturnValue('verified');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(mocks.getGroup).toHaveBeenCalledWith('https://org.test', 3);
    expect(mocks.getGroupStatus).toHaveBeenCalledWith(group, [{ id: 1, publicKey: 'pk' }]);
    const controller = wrapper.get('[data-testid="controller"]');
    expect(controller.attributes('data-active')).toBe('true');
    // The checked group object is what gets signed, not just its id
    expect(controller.attributes('data-group')).toBe('object');
  });

  test('asks for confirmation, with the group wording, when the group is not verified', async () => {
    mocks.getGroupStatus.mockReturnValue('unverifiable');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('false');
    const confirm = wrapper.get('[data-testid="confirm"]');
    expect(confirm.attributes('data-show')).toBe('true');
    expect(confirm.attributes('data-status')).toBe('unverifiable');
    expect(confirm.attributes('data-group')).toBe('true');
  });

  test('starts signing once the user confirms the warning', async () => {
    mocks.getGroupStatus.mockReturnValue('data-missing');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="confirm"]').trigger('click');

    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('true');
  });
});
