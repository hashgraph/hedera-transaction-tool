// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import SelectGroupMembersModal from '@renderer/components/ReviewerGroups/SelectGroupMembersModal.vue';

const mocks = vi.hoisted(() => ({
  contactsStore: {
    contacts: [] as any[],
    getContact: vi.fn((_userId: number) => undefined as any),
    fetchUserKeys: vi.fn(),
  },
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

function contact(userId: number, email: string, nickname = '', userKeys: { id: number; publicKey: string }[] = []) {
  return { user: { id: userId, email }, nickname, userKeys };
}

function mountModal(
  props: { show?: boolean; alreadyAdded?: number[] } = {},
  mountOptions: Record<string, unknown> = {},
) {
  return mount(SelectGroupMembersModal, {
    props: { show: true, ...props },
    ...mountOptions,
    global: {
      stubs: {
        AppModal: { props: ['show'], template: '<div v-if="show"><slot /></div>' },
        AppButton: {
          props: ['disabled'],
          template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        },
        // AppInput is used for real (not stubbed) so the mount-time focus call has a
        // real `inputRef` to grab.
        AppListItem: {
          props: ['selected'],
          template: '<div v-bind="$attrs" :data-selected="selected"><slot /></div>',
        },
      },
    },
  });
}

describe('SelectGroupMembersModal.vue', () => {
  beforeEach(() => {
    mocks.contactsStore.contacts = [];
    mocks.contactsStore.getContact.mockReset();
    mocks.contactsStore.fetchUserKeys.mockReset();
  });

  test('shows "no selectable users" when the contact list is empty', () => {
    const wrapper = mountModal();

    expect(wrapper.text()).toContain('There are no selectable users');
  });

  test('filters out already-added users and sorts the rest by display name', () => {
    mocks.contactsStore.contacts = [
      contact(1, 'carol@example.com'),
      contact(2, 'alice@example.com'),
      contact(3, 'already-added@example.com'),
    ];

    const wrapper = mountModal({ alreadyAdded: [3] });

    const rows = wrapper.findAll('[data-testid^="div-select-member-"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].attributes('data-testid')).toBe('div-select-member-2');
    expect(rows[1].attributes('data-testid')).toBe('div-select-member-1');
  });

  test('uses the nickname when set, falling back to email otherwise', () => {
    mocks.contactsStore.contacts = [
      contact(1, 'first@example.com', 'Nicky'),
      contact(2, 'second@example.com'),
    ];

    const wrapper = mountModal();

    expect(wrapper.find('[data-testid="div-select-member-1"]').text()).toContain('Nicky');
    expect(wrapper.find('[data-testid="div-select-member-2"]').text()).toContain('second@example.com');
  });

  test('expands a row on click, fetches fresh keys in the background, and lists its keys', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com')];
    mocks.contactsStore.getContact.mockReturnValue(
      contact(1, 'alice@example.com', '', [{ id: 10, publicKey: 'pk-1' }]),
    );

    const wrapper = mountModal();
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await nextTick();

    expect(mocks.contactsStore.fetchUserKeys).toHaveBeenCalledWith(1);
    expect(wrapper.find('[data-testid="div-select-member-key-10"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('pk-1');
  });

  test('shows a message when the expanded user has no registered keys', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com')];
    mocks.contactsStore.getContact.mockReturnValue(contact(1, 'alice@example.com'));

    const wrapper = mountModal();
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await nextTick();

    expect(wrapper.text()).toContain('This user has no registered keys');
  });

  test('clicking the expanded row again collapses it without deselecting its key', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com')];
    mocks.contactsStore.getContact.mockReturnValue(
      contact(1, 'alice@example.com', '', [{ id: 10, publicKey: 'pk-1' }]),
    );

    const wrapper = mountModal();
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-10"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="div-select-member-key-10"]').exists()).toBe(false);

    await wrapper.find('[data-testid="button-select-members-done"]').trigger('click');
    expect(wrapper.emitted('confirm')?.[0]).toEqual([[{ userId: 1, userKeyId: 10 }]]);
  });

  test('clicking a different, already-selected row deselects it', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com'), contact(2, 'bob@example.com')];
    mocks.contactsStore.getContact.mockImplementation((userId: number) =>
      userId === 1
        ? contact(1, 'alice@example.com', '', [{ id: 10, publicKey: 'pk-1' }])
        : contact(2, 'bob@example.com', '', [{ id: 20, publicKey: 'pk-2' }]),
    );

    const wrapper = mountModal();
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-10"]').trigger('click');
    // Expand a different row, then click the already-selected (now-collapsed) row again.
    await wrapper.find('[data-testid="div-select-member-2"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await nextTick();

    // Re-expand user 2 (collapsed by the click above) to pick its key.
    await wrapper.find('[data-testid="div-select-member-2"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-20"]').trigger('click');
    await wrapper.find('[data-testid="button-select-members-done"]').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([[{ userId: 2, userKeyId: 20 }]]);
  });

  test('selecting keys for two different members keeps both selections', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com'), contact(2, 'bob@example.com')];
    mocks.contactsStore.getContact.mockImplementation((userId: number) =>
      userId === 1
        ? contact(1, 'alice@example.com', '', [{ id: 10, publicKey: 'pk-1' }])
        : contact(2, 'bob@example.com', '', [{ id: 20, publicKey: 'pk-2' }]),
    );

    const wrapper = mountModal();
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-10"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-2"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-20"]').trigger('click');
    await wrapper.find('[data-testid="button-select-members-done"]').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([
      [
        { userId: 1, userKeyId: 10 },
        { userId: 2, userKeyId: 20 },
      ],
    ]);
  });

  test('selecting a different key for the same user replaces the prior selection', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com')];
    mocks.contactsStore.getContact.mockReturnValue(
      contact(1, 'alice@example.com', '', [
        { id: 10, publicKey: 'pk-1' },
        { id: 11, publicKey: 'pk-2' },
      ]),
    );

    const wrapper = mountModal();
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-10"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-11"]').trigger('click');
    await wrapper.find('[data-testid="button-select-members-done"]').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([[{ userId: 1, userKeyId: 11 }]]);
  });

  test('disables Select until at least one member is chosen, and emits confirm + closes on click', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com')];
    mocks.contactsStore.getContact.mockReturnValue(
      contact(1, 'alice@example.com', '', [{ id: 10, publicKey: 'pk-1' }]),
    );

    const wrapper = mountModal();
    const doneButton = () => wrapper.find('[data-testid="button-select-members-done"]');

    expect(doneButton().attributes('disabled')).not.toBeUndefined();

    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-10"]').trigger('click');
    expect(doneButton().attributes('disabled')).toBeUndefined();

    await doneButton().trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([[{ userId: 1, userKeyId: 10 }]]);
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
  });

  test('typing in search does not filter the member list', async () => {
    mocks.contactsStore.contacts = [
      contact(1, 'carol@example.com'),
      contact(2, 'alice@example.com'),
      contact(3, 'bob@example.com'),
    ];

    const wrapper = mountModal();
    await wrapper.find('[data-testid="input-select-members-search"]').setValue('carol');
    await nextTick();

    expect(wrapper.findAll('[data-testid^="div-select-member-"]')).toHaveLength(3);
  });

  test('clicking the close icon emits update:show false without confirming', async () => {
    const wrapper = mountModal();

    await wrapper.find('[data-testid="button-close-select-members-modal"]').trigger('click');

    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  test('clicking Cancel emits update:show false without confirming', async () => {
    const wrapper = mountModal();

    await wrapper.find('[data-testid="button-select-members-cancel"]').trigger('click');

    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  test('focuses the search input on mount', async () => {
    const wrapper = mountModal({}, { attachTo: document.body });
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(wrapper.find('[data-testid="input-select-members-search"]').element);
    wrapper.unmount();
  });

  test('resets search, expansion, and selections each time the modal reopens', async () => {
    mocks.contactsStore.contacts = [contact(1, 'alice@example.com')];
    mocks.contactsStore.getContact.mockReturnValue(
      contact(1, 'alice@example.com', '', [{ id: 10, publicKey: 'pk-1' }]),
    );

    const wrapper = mountModal();
    await wrapper.find('[data-testid="input-select-members-search"]').setValue('alice');
    await wrapper.find('[data-testid="div-select-member-1"]').trigger('click');
    await wrapper.find('[data-testid="div-select-member-key-10"]').trigger('click');

    await wrapper.setProps({ show: false });
    await wrapper.setProps({ show: true });
    await nextTick();

    expect((wrapper.find('[data-testid="input-select-members-search"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('[data-testid="div-select-member-key-10"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-select-members-done"]').attributes('disabled')).not.toBeUndefined();
  });
});
