// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';

import ReviewerGroups from '@renderer/pages/ReviewerGroups/ReviewerGroups.vue';
import { ActionStatus } from '@renderer/components/ActionController/ActionReport';

// vi.hoisted callbacks run before any imports resolve, so they can't call Vue's `reactive`
// (see the storeReviewerGroups mock factory below, which does the wrapping instead).
const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
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
  reviewerGroupsStore: {
    groups: [] as any[],
    fetching: false,
    selectedGroupId: null as number | null,
    selectGroup: vi.fn((id: number | null) => {
      mocks.reviewerGroupsStore.selectedGroupId = id;
    }),
    fetch: vi.fn(),
  },
  resolveReviewerSigningKey: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: mocks.routerPush,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/stores/storeReviewerGroups', () => {
  // vi.mock factories execute lazily (on first import of the mocked module), well after
  // top-level imports — including this file's own `reactive` import — are live, unlike
  // vi.hoisted callbacks. Reassigning mocks.reviewerGroupsStore to the reactive-wrapped
  // version means every later `mocks.reviewerGroupsStore.x = y` in a test mutates the same
  // proxy the mounted component reads from, so the template actually re-renders — same as
  // the real Pinia store.
  mocks.reviewerGroupsStore = reactive(mocks.reviewerGroupsStore);
  return {
    default: vi.fn(() => mocks.reviewerGroupsStore),
  };
});

vi.mock('@renderer/composables/useRedirectOnOnlyOrganization', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
}));

vi.mock('@renderer/components/ReviewerGroups/signReviewerPayload', () => ({
  resolveReviewerSigningKey: mocks.resolveReviewerSigningKey,
}));

describe('ReviewerGroups.vue', () => {
  beforeEach(() => {
    mocks.userStore.selectedOrganization = {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
      userKeys: [{ id: 5, publicKey: 'org-public-key' }],
    };
    mocks.userStore.keyPairs = [{ public_key: 'org-public-key' }];
    mocks.reviewerGroupsStore.groups = [];
    mocks.reviewerGroupsStore.fetching = false;
    mocks.reviewerGroupsStore.selectedGroupId = null;
    mocks.reviewerGroupsStore.fetch.mockReset();
    mocks.reviewerGroupsStore.selectGroup.mockClear();
    mocks.routerPush.mockReset();
    mocks.resolveReviewerSigningKey.mockReset();
    mocks.resolveReviewerSigningKey.mockReturnValue({ orgKeyId: 5, orgKeyPublicKey: 'org-public-key' });
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

  test('blocks navigation and shows the signing-key report when no key is available', async () => {
    mocks.userStore.selectedOrganization.admin = true;
    const report = {
      status: ActionStatus.Error,
      title: 'No signing key available',
      what: 'This action must be signed with one of your keys, but none are available on this device',
      next: 'Go to Settings > Keys and restore or import one of your keys, then try again',
    };
    mocks.resolveReviewerSigningKey.mockReturnValue(report);

    const wrapper = mountReviewerGroups();
    await wrapper.find('[data-testid="button-add-reviewer-group"]').trigger('click');
    await nextTick();

    expect(mocks.routerPush).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No signing key available');
  });

  test('lists groups and shows the store-selected group\'s details', async () => {
    mocks.reviewerGroupsStore.groups = [
      {
        id: 1,
        name: 'Treasury',
        description: 'Treasury movements',
        threshold: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    // Which group is selected (including picking the first one by default) is the store's
    // responsibility (see storeReviewerGroups.spec.ts) — mocked here, not re-derived.
    mocks.reviewerGroupsStore.selectedGroupId = 1;

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
      { id: 1, name: 'Treasury', description: '', threshold: 1 },
      { id: 2, name: 'Operations', description: '', threshold: 1 },
    ];
    mocks.reviewerGroupsStore.selectedGroupId = 1;

    const wrapper = mountReviewerGroups();
    await flushPromises();

    expect(wrapper.find('[data-testid="stub-reviewer-group-details"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="div-reviewer-group-1"]').classes()).toContain('is-selected');

    await wrapper.find('[data-testid="div-reviewer-group-2"]').trigger('click');

    expect(mocks.reviewerGroupsStore.selectGroup).toHaveBeenCalledWith(2);
    expect(wrapper.find('[data-testid="stub-reviewer-group-details"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="div-reviewer-group-2"]').classes()).toContain('is-selected');
    expect(wrapper.find('[data-testid="div-reviewer-group-1"]').classes()).not.toContain('is-selected');
  });
});
