import { describe, expect, test, vi, beforeEach } from 'vitest';

import { syncReviewerGroups } from '@renderer/services/reviewerSyncService';

const mocks = vi.hoisted(() => ({
  getReviewerState: vi.fn(),
  applyReviewerChanges: vi.fn(),
  getReviewerGroups: vi.fn(),
  getReviewerGroup: vi.fn(),
  getReviewerRules: vi.fn(),
  planReviewerSync: vi.fn(),
}));

vi.mock('@renderer/services/reviewerStoreService', () => ({
  getReviewerState: mocks.getReviewerState,
  applyReviewerChanges: mocks.applyReviewerChanges,
}));
vi.mock('@renderer/services/organization/reviewerGroups', () => ({
  getReviewerGroups: mocks.getReviewerGroups,
  getReviewerGroup: mocks.getReviewerGroup,
}));
vi.mock('@renderer/services/organization/reviewerRules', () => ({
  getReviewerRules: mocks.getReviewerRules,
}));
vi.mock('@shared/utils/reviewerSync', () => ({ planReviewerSync: mocks.planReviewerSync }));

const emptyPlan = {
  upsertGroups: [],
  deleteGroupIds: [],
  upsertRules: [],
  deleteRuleIds: [],
  failures: [],
};

describe('syncReviewerGroups', () => {
  const local = { groups: [], rules: [] };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getReviewerState.mockResolvedValue(local);
  });

  test('plans against the local state and the organization server', async () => {
    mocks.planReviewerSync.mockResolvedValue(emptyPlan);

    await syncReviewerGroups('org-1', 'https://org');

    expect(mocks.getReviewerState).toHaveBeenCalledWith('org-1');
    const [state, source] = mocks.planReviewerSync.mock.calls[0];
    expect(state).toBe(local);

    await source.listGroups();
    await source.getGroup(3);
    await source.listRules();
    expect(mocks.getReviewerGroups).toHaveBeenCalledWith('https://org');
    expect(mocks.getReviewerGroup).toHaveBeenCalledWith('https://org', 3);
    expect(mocks.getReviewerRules).toHaveBeenCalledWith('https://org');
  });

  test('writes the planned changes and returns the failures', async () => {
    const failure = { groupId: 1 };
    mocks.planReviewerSync.mockResolvedValue({
      ...emptyPlan,
      deleteGroupIds: [4],
      failures: [failure],
    });

    const failures = await syncReviewerGroups('org-1', 'https://org');

    expect(mocks.applyReviewerChanges).toHaveBeenCalledWith('org-1', {
      upsertGroups: [],
      deleteGroupIds: [4],
      upsertRules: [],
      deleteRuleIds: [],
    });
    expect(failures).toEqual([failure]);
  });

  test('does not write when nothing changed', async () => {
    mocks.planReviewerSync.mockResolvedValue(emptyPlan);
    expect(await syncReviewerGroups('org-1', 'https://org')).toEqual([]);
    expect(mocks.applyReviewerChanges).not.toHaveBeenCalled();
  });

  test('applies nothing when the server cannot be reached', async () => {
    mocks.planReviewerSync.mockRejectedValue(new Error('offline'));
    await expect(syncReviewerGroups('org-1', 'https://org')).rejects.toThrow('offline');
    expect(mocks.applyReviewerChanges).not.toHaveBeenCalled();
  });
});
