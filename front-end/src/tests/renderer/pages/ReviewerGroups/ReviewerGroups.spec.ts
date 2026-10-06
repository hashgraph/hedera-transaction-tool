// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ReviewerGroups from '@renderer/pages/ReviewerGroups/ReviewerGroups.vue';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
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

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mocks.routerPush,
  })),
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
    mocks.routerPush.mockReset();
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
            template: '<div data-testid="stub-app-loader" />',
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

  test('shows the Add New button for admins', () => {
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountReviewerGroups();

    const addButton = wrapper.find('[data-testid="button-add-reviewer-group"]');
    expect(addButton.exists()).toBe(true);
    expect(addButton.attributes('disabled')).toBeUndefined();
  });

  test('navigates to the create-group page when Add New is clicked', async () => {
    mocks.userStore.selectedOrganization.admin = true;

    const wrapper = mountReviewerGroups();
    await wrapper.find('[data-testid="button-add-reviewer-group"]').trigger('click');
    await nextTick();

    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'createReviewerGroup' });
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

  test('shows the loader instead of the list or empty state while fetching', () => {
    mocks.reviewerGroupsStore.fetching = true;

    const wrapper = mountReviewerGroups();

    expect(wrapper.find('[data-testid="stub-app-loader"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="p-no-groups-found"]').exists()).toBe(false);
  });

  test('clicking a different group selects it and highlights its row', async () => {
    mocks.reviewerGroupsStore.groups = [
      { id: 1, name: 'Treasury', description: '', threshold: 1, memberCount: 1, ruleCount: 0 },
      { id: 2, name: 'Operations', description: '', threshold: 1, memberCount: 1, ruleCount: 0 },
    ];

    const wrapper = mountReviewerGroups();
    await flushPromises();

    expect(wrapper.find('[data-testid="stub-reviewer-group-details"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="div-reviewer-group-1"]').classes()).toContain('is-selected');

    await wrapper.find('[data-testid="div-reviewer-group-2"]').trigger('click');

    expect(wrapper.find('[data-testid="stub-reviewer-group-details"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="div-reviewer-group-2"]').classes()).toContain('is-selected');
    expect(wrapper.find('[data-testid="div-reviewer-group-1"]').classes()).not.toContain('is-selected');
  });
});
