import { describe, expect, test, vi, beforeEach } from 'vitest';

import { applyReviewerChanges, getReviewerState } from '@renderer/services/reviewerStoreService';

describe('reviewerStoreService', () => {
  const api = { getState: vi.fn(), applyChanges: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    (window as any).electronAPI = { local: { reviewerStore: api } };
  });

  test('reads the state through the main process', async () => {
    api.getState.mockResolvedValue({ groups: [], rules: [] });
    expect(await getReviewerState('org-1')).toEqual({ groups: [], rules: [] });
    expect(api.getState).toHaveBeenCalledWith('org-1');
  });

  test('applies changes through the main process', async () => {
    const changes = { upsertGroups: [], deleteGroupIds: [], upsertRules: [], deleteRuleIds: [] };
    await applyReviewerChanges('org-1', changes);
    expect(api.applyChanges).toHaveBeenCalledWith('org-1', changes);
  });

  test('surfaces a main-process failure', async () => {
    api.getState.mockRejectedValue(new Error('db'));
    await expect(getReviewerState('org-1')).rejects.toThrow();
  });
});
