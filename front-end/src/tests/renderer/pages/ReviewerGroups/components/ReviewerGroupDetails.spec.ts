// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import ReviewerGroupDetails from '@renderer/pages/ReviewerGroups/components/ReviewerGroupDetails.vue';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
      userKeys: [{ id: 5, publicKey: 'org-public-key' }],
    },
    keyPairs: [{ public_key: 'org-public-key' }],
  },
  contactsStore: {
    getContact: vi.fn((_userId: number) => undefined as any),
  },
  getReviewerGroup: vi.fn(),
  getReviewerGroupChanges: vi.fn(),
  getReviewerRuleChanges: vi.fn(),
  toastError: vi.fn(),
  routerPush: vi.fn(),
  resolveReviewerSigningKey: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mocks.routerPush })),
}));

vi.mock('@shared/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('@shared/constants')>();
  return { ...actual, FEATURE_REVIEWER_ENABLED: true };
});

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/services/organization', () => ({
  getReviewerGroup: mocks.getReviewerGroup,
  getReviewerGroupChanges: mocks.getReviewerGroupChanges,
  getReviewerRuleChanges: mocks.getReviewerRuleChanges,
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  capitalize: (value: string) => value.charAt(0).toUpperCase() + value.slice(1),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
}));

vi.mock('@renderer/components/ReviewerGroups/signReviewerPayload', () => ({
  resolveReviewerSigningKey: mocks.resolveReviewerSigningKey,
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({
      error: mocks.toastError,
    })),
  },
}));

vi.mock('@renderer/components/ui/AppPublicKeyNickname.vue', () => ({
  default: {
    props: ['publicKey'],
    template: '<span data-testid="stub-public-key-nickname">{{ publicKey }}</span>',
  },
}));

function baseGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Treasury',
    description: 'Treasury movements',
    threshold: 2,
    members: [
      { id: 1, groupId: 1, userId: 10, userKeyId: 100, createdAt: new Date().toISOString() },
      { id: 2, groupId: 1, userId: 11, userKeyId: 101, createdAt: new Date().toISOString() },
    ],
    rules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ReviewerGroupDetails.vue', () => {
  beforeEach(() => {
    mocks.userStore.selectedOrganization = {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
      userKeys: [{ id: 5, publicKey: 'org-public-key' }],
    };
    mocks.userStore.keyPairs = [{ public_key: 'org-public-key' }];
    mocks.resolveReviewerSigningKey.mockReset();
    mocks.resolveReviewerSigningKey.mockReturnValue({ orgKeyId: 5, orgKeyPublicKey: 'org-public-key' });
    mocks.contactsStore.getContact.mockReset();
    mocks.contactsStore.getContact.mockImplementation((userId: number) => ({
      user: { id: userId },
      userKeys: [{ id: userId + 90, publicKey: `public-key-${userId}` }],
    }));
    mocks.getReviewerGroup.mockReset();
    mocks.getReviewerGroupChanges.mockReset();
    mocks.getReviewerGroupChanges.mockResolvedValue([]);
    mocks.getReviewerRuleChanges.mockReset();
    mocks.getReviewerRuleChanges.mockResolvedValue([]);
    mocks.toastError.mockReset();
    mocks.routerPush.mockClear();
  });

  const createRuleModalStub = {
    props: ['show', 'groupId'],
    emits: ['update:show', 'created'],
    template:
      '<div v-if="show" data-testid="stub-create-rule-modal">' +
      '{{ groupId }}' +
      '<button data-testid="create-rule-confirm" type="button" ' +
      '@click="$emit(\'created\'); $emit(\'update:show\', false)"></button>' +
      '</div>',
  };

  const deleteGroupModalStub = {
    props: ['show', 'groupId', 'groupName'],
    emits: ['update:show', 'deleted'],
    template:
      '<div v-if="show" data-testid="stub-delete-group-modal">' +
      '{{ groupName }}' +
      '<button data-testid="delete-group-confirm" type="button" ' +
      '@click="$emit(\'deleted\'); $emit(\'update:show\', false)"></button>' +
      '</div>',
  };

  const deleteRuleModalStub = {
    props: ['show', 'ruleId', 'ruleLabel'],
    emits: ['update:show', 'deleted'],
    template:
      '<div v-if="show" data-testid="stub-delete-rule-modal">' +
      '{{ ruleId }}:{{ ruleLabel }}' +
      '<button data-testid="delete-rule-confirm" type="button" ' +
      '@click="$emit(\'deleted\'); $emit(\'update:show\', false)"></button>' +
      '</div>',
  };

  function mountDetails(groupId = 1) {
    return mount(ReviewerGroupDetails, {
      props: { groupId },
      global: {
        stubs: {
          AppLoader: { template: '<div data-testid="stub-loader" />' },
          CreateRuleModal: createRuleModalStub,
          DeleteGroupModal: deleteGroupModalStub,
          DeleteRuleModal: deleteRuleModalStub,
        },
      },
    });
  }

  test('shows a loader while the group is being fetched', async () => {
    mocks.getReviewerGroup.mockReturnValue(new Promise(() => {}));

    const wrapper = mountDetails();

    expect(wrapper.find('[data-testid="stub-loader"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="p-reviewer-group-name"]').exists()).toBe(false);
  });

  test('shows the group name, description, threshold, and members once loaded', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="stub-loader"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="p-reviewer-group-name"]').text()).toBe('Treasury');
    expect(wrapper.text()).toContain('Treasury movements');
    expect(wrapper.text()).toContain('Reviewer Threshold: 2 of 2');

    const memberNicknames = wrapper.findAll('[data-testid="stub-public-key-nickname"]');
    expect(memberNicknames).toHaveLength(2);
    expect(memberNicknames[0].text()).toBe('public-key-10');
    expect(memberNicknames[1].text()).toBe('public-key-11');
  });

  test('replaces Edit/Remove with a disabled "Delete Pending" button when a pending deletion change record exists', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.getReviewerGroupChanges.mockResolvedValue([
      { id: 1, groupId: 1, type: 'DELETE', status: 'PENDING' },
    ]);
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    const pendingButton = wrapper.find('[data-testid="button-pending-reviewer-group-change"]');
    expect(pendingButton.text()).toContain('Delete Pending');
    expect(pendingButton.attributes('disabled')).not.toBeUndefined();
    expect(wrapper.find('[data-testid="button-edit-reviewer-group"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-remove-reviewer-group"]').exists()).toBe(false);
  });

  test('replaces Edit/Remove with a disabled "Update Pending" button when a pending update change record exists', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.getReviewerGroupChanges.mockResolvedValue([
      { id: 1, groupId: 1, type: 'UPDATE', status: 'PENDING' },
    ]);
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    const pendingButton = wrapper.find('[data-testid="button-pending-reviewer-group-change"]');
    expect(pendingButton.text()).toContain('Update Pending');
    expect(pendingButton.attributes('disabled')).not.toBeUndefined();
    expect(wrapper.find('[data-testid="button-edit-reviewer-group"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-remove-reviewer-group"]').exists()).toBe(false);
  });

  test('shows Edit/Remove instead of the pending button when there is no pending change', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.getReviewerGroupChanges.mockResolvedValue([
      { id: 1, groupId: 1, type: 'DELETE', status: 'APPLIED' },
    ]);
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="button-pending-reviewer-group-change"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-edit-reviewer-group"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-remove-reviewer-group"]').exists()).toBe(true);
  });

  test('shows the rules table with formatted columns when rules exist', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaId: '0.0.1234',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );

    const wrapper = mountDetails();
    await flushPromises();

    const row = wrapper.find('[data-testid="row-reviewer-rule-5"]');
    expect(row.exists()).toBe(true);
    const cells = row.findAll('td');
    expect(cells.map(c => c.text())).toEqual(['0.0.1234', 'Sender', 'Transfer Transaction', 'Mainnet']);
  });

  test('shows the empty-rules message when the group has no rules', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup({ rules: [] }));

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).toContain('No rules assigned to this group yet.');
  });

  test('sorts the rules table by column, toggling direction on repeat clicks', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 1,
            groupId: 1,
            hederaId: '0.0.2000',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            groupId: 1,
            hederaId: '0.0.1000',
            network: 'testnet',
            entityRole: 'receiver',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );

    const wrapper = mountDetails();
    await flushPromises();

    const firstColumnCell = (rowIndex: number) =>
      wrapper.findAll('tbody tr')[rowIndex].findAll('td')[0].text();

    // Default sort is by Entity / Node ID ascending
    expect(firstColumnCell(0)).toBe('0.0.1000');
    expect(firstColumnCell(1)).toBe('0.0.2000');

    const headers = wrapper.findAll('th .table-sort-link');
    await headers[0].trigger('click');

    expect(firstColumnCell(0)).toBe('0.0.2000');
    expect(firstColumnCell(1)).toBe('0.0.1000');
  });

  test('shows a remove button per rule row for admins, and opens the delete-rule modal on click', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaId: '0.0.1234',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    expect(mocks.getReviewerRuleChanges).toHaveBeenCalledWith('https://org.example.com', 5);
    expect(wrapper.find('[data-testid="stub-delete-rule-modal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="row-reviewer-rule-5"]').classes()).not.toContain(
      'reviewer-rule-row-pending-delete',
    );

    await wrapper.find('[data-testid="button-remove-reviewer-rule-5"]').trigger('click');

    const modal = wrapper.find('[data-testid="stub-delete-rule-modal"]');
    expect(modal.text()).toBe('5:0.0.1234');

    mocks.getReviewerGroup.mockClear();
    await wrapper.find('[data-testid="delete-rule-confirm"]').trigger('click');
    await flushPromises();

    expect(mocks.getReviewerGroup).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="stub-delete-rule-modal"]').exists()).toBe(false);
  });

  test('blocks per-rule Remove and shows the signing-key report when no key is available, instead of opening the delete-rule modal', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaId: '0.0.1234',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    mocks.userStore.selectedOrganization.admin = true;
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    const wrapper = mountDetails();
    await flushPromises();

    await wrapper.find('[data-testid="button-remove-reviewer-rule-5"]').trigger('click');

    expect(wrapper.find('[data-testid="stub-delete-rule-modal"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No signing key available');
  });

  test('shows a disabled, tooltipped delete icon instead of the remove button when a rule has a pending deletion', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaId: '0.0.1234',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    mocks.userStore.selectedOrganization.admin = true;
    mocks.getReviewerRuleChanges.mockResolvedValue([
      { id: 1, ruleId: 5, groupId: 1, action: 'remove', status: 'PENDING' },
    ]);

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="button-pending-reviewer-rule-5"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-remove-reviewer-rule-5"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="row-reviewer-rule-5"]').classes()).toContain(
      'reviewer-rule-row-pending-delete',
    );
  });

  test('hides the rule actions column for non-admins', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaId: '0.0.1234',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'TRANSFER',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    mocks.userStore.selectedOrganization.admin = false;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="button-remove-reviewer-rule-5"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="row-reviewer-rule-5"]').findAll('td')).toHaveLength(4);
  });

  test('hides the admin-only Add Rule / Remove buttons for non-admins', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = false;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="button-add-reviewer-rule"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-remove-reviewer-group"]').exists()).toBe(false);
  });

  test('shows the admin-only Add Rule / Remove buttons enabled for admins', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    const addRuleButton = wrapper.find('[data-testid="button-add-reviewer-rule"]');
    const removeButton = wrapper.find('[data-testid="button-remove-reviewer-group"]');
    expect(addRuleButton.exists()).toBe(true);
    expect(addRuleButton.attributes('disabled')).toBeUndefined();
    expect(removeButton.exists()).toBe(true);
    expect(removeButton.attributes('disabled')).toBeUndefined();
  });

  test('clicking Edit navigates to the createReviewerGroup route for this group', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails(7);
    await flushPromises();

    await wrapper.find('[data-testid="button-edit-reviewer-group"]').trigger('click');

    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'createReviewerGroup',
      params: { groupId: '7' },
    });
  });

  test('blocks Edit and shows the signing-key report when no key is available, instead of navigating', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    const wrapper = mountDetails(7);
    await flushPromises();

    await wrapper.find('[data-testid="button-edit-reviewer-group"]').trigger('click');

    expect(mocks.routerPush).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No signing key available');
  });

  test('clicking Add Rule opens the create-rule modal, and refetches the group once a rule is created', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="stub-create-rule-modal"]').exists()).toBe(false);

    await wrapper.find('[data-testid="button-add-reviewer-rule"]').trigger('click');
    expect(wrapper.find('[data-testid="stub-create-rule-modal"]').text()).toBe('1');

    mocks.getReviewerGroup.mockClear();
    await wrapper.find('[data-testid="create-rule-confirm"]').trigger('click');
    await flushPromises();

    expect(mocks.getReviewerGroup).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="stub-create-rule-modal"]').exists()).toBe(false);
  });

  test('blocks Add Rule and shows the signing-key report when no key is available, instead of opening the create-rule modal', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    const wrapper = mountDetails();
    await flushPromises();

    await wrapper.find('[data-testid="button-add-reviewer-rule"]').trigger('click');

    expect(wrapper.find('[data-testid="stub-create-rule-modal"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No signing key available');
  });

  test('clicking Remove opens the delete-group modal, and refetches the group once deletion is requested', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="stub-delete-group-modal"]').exists()).toBe(false);

    await wrapper.find('[data-testid="button-remove-reviewer-group"]').trigger('click');
    expect(wrapper.find('[data-testid="stub-delete-group-modal"]').text()).toBe('Treasury');

    mocks.getReviewerGroup.mockClear();
    await wrapper.find('[data-testid="delete-group-confirm"]').trigger('click');
    await flushPromises();

    expect(mocks.getReviewerGroup).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="stub-delete-group-modal"]').exists()).toBe(false);
  });

  test('blocks Remove and shows the signing-key report when no key is available, instead of opening the delete modal', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    const wrapper = mountDetails();
    await flushPromises();

    await wrapper.find('[data-testid="button-remove-reviewer-group"]').trigger('click');

    expect(wrapper.find('[data-testid="stub-delete-group-modal"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No signing key available');
  });

  test('shows an error toast and clears the group when the fetch fails', async () => {
    mocks.getReviewerGroup.mockRejectedValue(new Error('network down'));

    const wrapper = mountDetails();
    await flushPromises();

    expect(mocks.toastError).toHaveBeenCalledWith('network down');
    expect(wrapper.find('[data-testid="p-reviewer-group-name"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stub-loader"]').exists()).toBe(false);
  });

  test('refetches when the groupId prop changes', async () => {
    mocks.getReviewerGroup.mockResolvedValueOnce(baseGroup({ id: 1, name: 'Treasury' }));

    const wrapper = mountDetails(1);
    await flushPromises();
    expect(wrapper.find('[data-testid="p-reviewer-group-name"]').text()).toBe('Treasury');

    mocks.getReviewerGroup.mockResolvedValueOnce(baseGroup({ id: 2, name: 'Compliance' }));
    await wrapper.setProps({ groupId: 2 });
    await flushPromises();

    expect(wrapper.find('[data-testid="p-reviewer-group-name"]').text()).toBe('Compliance');
    expect(mocks.getReviewerGroup).toHaveBeenCalledTimes(2);
    expect(mocks.getReviewerGroup).toHaveBeenLastCalledWith('https://org.example.com', 2);
  });
});
