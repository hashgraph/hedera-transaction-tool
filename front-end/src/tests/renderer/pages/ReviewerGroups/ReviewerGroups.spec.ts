// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import ReviewerGroups from '@renderer/pages/ReviewerGroups/ReviewerGroups.vue';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    },
  },
  reviewerGroupsStore: {
    groups: [] as any[],
    fetching: false,
    fetch: vi.fn(),
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeReviewerGroups', () => ({
  default: vi.fn(() => mocks.reviewerGroupsStore),
}));

vi.mock('@renderer/composables/useRedirectOnOnlyOrganization', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
}));

describe('ReviewerGroups.vue', () => {
  beforeEach(() => {
    mocks.userStore.selectedOrganization = {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    };
    mocks.reviewerGroupsStore.groups = [];
    mocks.reviewerGroupsStore.fetching = false;
    mocks.reviewerGroupsStore.fetch.mockReset();
  });

  function mountReviewerGroups() {
    return mount(ReviewerGroups, {
      global: {
        stubs: {
          AppButton: {
            props: ['disabled'],
            template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
          },
          AppLoader: {
            template: '<div />',
          },
          ReviewerGroupDetails: {
            props: ['groupId'],
            template: '<div data-testid="stub-reviewer-group-details">{{ groupId }}</div>',
          },
        },
      },
    });
  }

  test('shows the empty groups message when the store has no groups', () => {
    const wrapper = mountReviewerGroups();

    const emptyState = wrapper.find('[data-testid="p-no-groups-found"]');

    expect(emptyState.exists()).toBe(true);
    expect(emptyState.text()).toBe('No reviewer groups found');
  });

  test('hides the Add New button for non-admins', () => {
    const wrapper = mountReviewerGroups();

    expect(wrapper.find('[data-testid="button-add-reviewer-group"]').exists()).toBe(false);
  });

  test('shows the Add New button for admins, disabled until group creation ships', () => {
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountReviewerGroups();

    const addButton = wrapper.find('[data-testid="button-add-reviewer-group"]');
    expect(addButton.exists()).toBe(true);
    expect(addButton.attributes('disabled')).not.toBeUndefined();
  });

  test('lists groups with a truncated description and selects the first one', async () => {
    mocks.reviewerGroupsStore.groups = [
      {
        id: 1,
        name: 'Treasury',
        description: 'Treasury movements',
        threshold: 2,
        memberCount: 3,
        ruleCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const wrapper = mountReviewerGroups();
    await flushPromises();

    expect(wrapper.text()).toContain('Treasury');
    expect(wrapper.text()).toContain('Treasury movements');
    expect(wrapper.find('[data-testid="stub-reviewer-group-details"]').text()).toBe('1');
  });
});
