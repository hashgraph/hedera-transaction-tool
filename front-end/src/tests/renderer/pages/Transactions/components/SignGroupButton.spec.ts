// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { h } from 'vue';

interface GroupControllerProps {
  groupOrId: unknown;
  callback?: (groupId: number, signed: boolean) => void;
  emitActivate?: (activate: boolean) => void;
  emitShow?: (show: boolean) => void;
}

const mocks = vi.hoisted(() => {
  const controllerProps: GroupControllerProps = { groupOrId: null };
  return {
    getGroupStatus: vi.fn(),
    getGroup: vi.fn(),
    controllerProps,
  };
});

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
          props: ['activate', 'groupOrId', 'callback'],
          emits: ['update:activate'],
          setup(props: any, { emit }: any) {
            mocks.controllerProps.emitActivate = (v: boolean) => emit('update:activate', v);
            return () => {
              mocks.controllerProps.groupOrId = props.groupOrId;
              mocks.controllerProps.callback = props.callback;
              return h('div', {
                'data-testid': 'controller',
                'data-active': String(props.activate),
                'data-group': typeof props.groupOrId,
              });
            };
          },
        },
        CreatorSignatureConfirmModal: {
          props: { show: Boolean, status: String, group: Boolean, callback: Function },
          emits: ['update:show'],
          setup(_: unknown, { emit }: any) {
            mocks.controllerProps.emitShow = (v: boolean) => emit('update:show', v);
            return {};
          },
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
    mocks.controllerProps.groupOrId = null;
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

  test('hands the controller a snapshot, not the fetched group object', async () => {
    mocks.getGroupStatus.mockReturnValue('verified');
    const item = { seq: 1, transactionId: 5, transaction: { id: 5 } };
    const fetched = { id: 3, description: 'before', groupItems: [item] };
    mocks.getGroup.mockResolvedValue(fetched);
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    const passed = mocks.controllerProps.groupOrId as typeof fetched;
    expect(passed).toEqual(fetched);
    expect(passed).not.toBe(fetched);
    expect(passed.groupItems).not.toBe(fetched.groupItems);
    expect(passed.groupItems[0]).not.toBe(item);

    // In-place changes to the fetched group after the click must not alter what will be signed
    fetched.description = 'after';
    fetched.groupItems.push({ seq: 2, transactionId: 6, transaction: { id: 6 } });
    item.transactionId = 99;
    expect(passed.description).toBe('before');
    expect(passed.groupItems).toHaveLength(1);
    expect(passed.groupItems[0].transactionId).toBe(5);
  });

  test('falls back to the group id until a group has been fetched', () => {
    const wrapper = render();

    expect(wrapper.get('[data-testid="controller"]').attributes('data-group')).toBe('number');
  });

  test('re-emits the result when the controller finishes signing', async () => {
    mocks.getGroupStatus.mockReturnValue('verified');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    await mocks.controllerProps.callback!(3, false);
    await mocks.controllerProps.callback!(3, true);

    expect(wrapper.emitted('transactionGroupSigned')).toEqual([[{ groupId: 3, signed: true }]]);
  });

  test('closes the confirmation and resets signing from child v-model updates', async () => {
    mocks.getGroupStatus.mockReturnValue('unverifiable');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    mocks.controllerProps.emitShow!(false);
    await flushPromises();
    expect(wrapper.get('[data-testid="confirm"]').attributes('data-show')).toBe('false');

    mocks.controllerProps.emitActivate!(true);
    await flushPromises();
    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('true');
    mocks.controllerProps.emitActivate!(false);
    await flushPromises();
    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('false');
  });
});
