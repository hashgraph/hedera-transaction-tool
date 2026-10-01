// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import ReviewerGroupDetails from '@renderer/pages/ReviewerGroups/components/ReviewerGroupDetails.vue';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    },
  },
  contactsStore: {
    getContact: vi.fn((_userId: number) => undefined as any),
  },
  getReviewerGroup: vi.fn(),
  getReviewerGroupChanges: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => mocks.contactsStore),
}));

vi.mock('@renderer/services/organization', () => ({
  getReviewerGroup: mocks.getReviewerGroup,
  getReviewerGroupChanges: mocks.getReviewerGroupChanges,
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
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
    };
    mocks.contactsStore.getContact.mockReset();
    mocks.contactsStore.getContact.mockImplementation((userId: number) => ({
      user: { id: userId },
      userKeys: [{ id: userId + 90, publicKey: `public-key-${userId}` }],
    }));
    mocks.getReviewerGroup.mockReset();
    mocks.getReviewerGroupChanges.mockReset();
    mocks.getReviewerGroupChanges.mockResolvedValue([]);
    mocks.toastError.mockReset();
  });

  function mountDetails(groupId = 1) {
    return mount(ReviewerGroupDetails, {
      props: { groupId },
      global: {
        stubs: {
          AppLoader: { template: '<div data-testid="stub-loader" />' },
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

  test('shows a pending badge only when a pending deletion change record exists', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.getReviewerGroupChanges.mockResolvedValue([
      { id: 1, groupId: 1, type: 'DELETE', status: 'PENDING' },
    ]);
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="badge-reviewer-group-pending"]').exists()).toBe(true);
  });

  test('hides the pending badge when there is no pending deletion', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.getReviewerGroupChanges.mockResolvedValue([
      { id: 1, groupId: 1, type: 'DELETE', status: 'APPLIED' },
    ]);
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="badge-reviewer-group-pending"]').exists()).toBe(false);
  });

  test('shows the rules table with formatted columns when rules exist', async () => {
    mocks.getReviewerGroup.mockResolvedValue(
      baseGroup({
        rules: [
          {
            id: 5,
            groupId: 1,
            hederaEntityId: '0.0.1234',
            network: 'mainnet',
            entityRole: 'sender',
            transactionType: 'CRYPTOTRANSFER',
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
    expect(cells.map(c => c.text())).toEqual(['0.0.1234', 'Sender', 'Transfer', 'Mainnet']);
  });

  test('shows the empty-rules message when the group has no rules', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup({ rules: [] }));

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).toContain('No rules assigned to this group yet.');
  });

  test('hides the admin-only Add Rule / Remove buttons for non-admins', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = false;

    const wrapper = mountDetails();
    await flushPromises();

    expect(wrapper.find('[data-testid="button-add-reviewer-rule"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-remove-reviewer-group"]').exists()).toBe(false);
  });

  test('shows the admin-only Add Rule / Remove buttons disabled for admins', async () => {
    mocks.getReviewerGroup.mockResolvedValue(baseGroup());
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountDetails();
    await flushPromises();

    const addRuleButton = wrapper.find('[data-testid="button-add-reviewer-rule"]');
    const removeButton = wrapper.find('[data-testid="button-remove-reviewer-group"]');
    expect(addRuleButton.exists()).toBe(true);
    expect(addRuleButton.attributes('disabled')).not.toBeUndefined();
    expect(removeButton.exists()).toBe(true);
    expect(removeButton.attributes('disabled')).not.toBeUndefined();
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
