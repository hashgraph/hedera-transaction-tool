// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { id: 'local-user-id' },
    selectedOrganization: {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    },
  },
  getReviewerGroups: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.userStore),
}));

vi.mock('@renderer/services/organization', () => ({
  getReviewerGroups: mocks.getReviewerGroups,
}));

vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: vi.fn((user: unknown) => user !== null),
  isLoggedInOrganization: vi.fn((organization: unknown) => organization !== null),
}));

import useReviewerGroupsStore from '@renderer/stores/storeReviewerGroups';

function group(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Group ${id}`,
    description: null,
    threshold: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useReviewerGroupsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.userStore.selectedOrganization = {
      admin: false,
      serverUrl: 'https://org.example.com',
      userId: 1,
    };
    mocks.getReviewerGroups.mockReset();
  });

  test('selects the first group after the initial fetch', async () => {
    mocks.getReviewerGroups.mockResolvedValue([group(1), group(2)]);

    const store = useReviewerGroupsStore();
    await store.fetch();

    expect(store.selectedGroupId).toBe(1);
  });

  // Covers the ReviewerGroups.vue -> createReviewerGroup (edit) -> ReviewerGroups.vue round
  // trip, which remounts the page and would lose a component-local selection.
  test('keeps the current selection across a refetch when it still exists', async () => {
    mocks.getReviewerGroups.mockResolvedValue([group(1), group(2)]);
    const store = useReviewerGroupsStore();
    await store.fetch();

    store.selectGroup(2);
    mocks.getReviewerGroups.mockResolvedValue([group(1, { name: 'Renamed' }), group(2)]);
    await store.fetch();

    expect(store.selectedGroupId).toBe(2);
  });

  test('falls back to the first group when the selected group no longer exists', async () => {
    mocks.getReviewerGroups.mockResolvedValue([group(1), group(2)]);
    const store = useReviewerGroupsStore();
    await store.fetch();
    store.selectGroup(2);

    mocks.getReviewerGroups.mockResolvedValue([group(1)]);
    await store.fetch();

    expect(store.selectedGroupId).toBe(1);
  });

  test('clears the selection when the group list becomes empty', async () => {
    mocks.getReviewerGroups.mockResolvedValue([group(1)]);
    const store = useReviewerGroupsStore();
    await store.fetch();

    mocks.getReviewerGroups.mockResolvedValue([]);
    await store.fetch();

    expect(store.selectedGroupId).toBeNull();
  });

  // Covers the ReviewerGroups.vue -> createReviewerGroup (create) -> ReviewerGroups.vue round
  // trip: CreateReviewerGroup.vue calls selectGroup with the newly created group's id so it
  // becomes the selection, rather than staying on whatever was selected before navigating away.
  test('selectGroup lets a caller pick a group explicitly, and it survives the next fetch', async () => {
    mocks.getReviewerGroups.mockResolvedValue([group(1)]);
    const store = useReviewerGroupsStore();
    await store.fetch();

    store.selectGroup(99);
    mocks.getReviewerGroups.mockResolvedValue([group(1), group(99, { name: 'New Group' })]);
    await store.fetch();

    expect(store.selectedGroupId).toBe(99);
  });
});
