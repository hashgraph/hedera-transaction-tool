// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@prisma/client', () => ({ Prisma: {} }));

vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionType: vi.fn(() => 'Transfer'),
}));

import { addDraft } from '@renderer/services/transactionDraftsService';

describe('transactionDraftsService.addDraft', () => {
  let api: any;

  beforeEach(() => {
    api = {
      transactionDrafts: {
        addDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
      },
    };
    (window as any).electronAPI = { local: api };
  });

  test('defaults submitManually to false', async () => {
    await addDraft('user-1', new Uint8Array([1, 2]), 'desc');

    const saved = api.transactionDrafts.addDraft.mock.calls[0][0];
    expect(saved.submitManually).toBe(false);
    expect(saved.transactionBytes).toBe('1,2');
    expect(saved.details).toBeNull();
  });

  test('persists submitManually when set', async () => {
    await addDraft('user-1', new Uint8Array([1, 2]), 'desc', 'details', true);

    const saved = api.transactionDrafts.addDraft.mock.calls[0][0];
    expect(saved.submitManually).toBe(true);
    expect(saved.details).toBe('details');
  });
});
