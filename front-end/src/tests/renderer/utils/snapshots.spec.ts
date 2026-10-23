import { describe, expect, test } from 'vitest';
import { reactive } from 'vue';

import type { ITransaction } from '@shared/interfaces';
import type { IGroup } from '@renderer/services/organization';

import { snapshotGroup, snapshotTransaction } from '@renderer/utils';

const makeTx = (id: number, transactionBytes = 'aa') =>
  ({ id, transactionId: `0.0.1@${id}`, transactionBytes }) as unknown as ITransaction;

const makeGroup = (ids: number[]) =>
  ({
    id: 7,
    groupItems: ids.map(id => ({ seq: id, transactionId: id, transaction: makeTx(id) })),
  }) as unknown as IGroup;

describe('snapshotTransaction', () => {
  test('is unaffected by later changes to a reactive transaction', () => {
    const live = reactive(makeTx(1));
    const snapshot = snapshotTransaction(live);

    live.transactionBytes = 'bb';

    expect(snapshot.transactionBytes).toBe('aa');
  });

  test('returns a plain copy, not the original object', () => {
    const tx = makeTx(1);
    expect(snapshotTransaction(tx)).not.toBe(tx);
    expect(snapshotTransaction(tx)).toEqual(tx);
  });
});

describe('snapshotGroup', () => {
  test('is unaffected by items being replaced or added to a reactive group', () => {
    const live = reactive(makeGroup([1]));
    const snapshot = snapshotGroup(live);

    live.groupItems[0].transaction = makeTx(99);
    live.groupItems.push(makeGroup([98]).groupItems[0]);

    expect(snapshot.groupItems.map(item => item.transaction.id)).toEqual([1]);
  });

  test('keeps the group fields', () => {
    expect(snapshotGroup(makeGroup([1, 2]))).toMatchObject({ id: 7 });
  });
});
