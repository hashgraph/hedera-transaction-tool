import type { IReviewerGroupDetail, IReviewerRule, IReviewerStoreState } from '@shared/interfaces';
import { planReviewerSync, type IReviewerSyncSource } from '@shared/utils/reviewerSync';

import { makeGroupDetail, makeMember, makeRule, storedGroup } from './reviewerFixtures';

const empty: IReviewerStoreState = { groups: [], rules: [] };

const makeSource = (opts: {
  listed?: number[];
  groups?: Record<number, IReviewerGroupDetail>;
  rules?: IReviewerRule[];
}): IReviewerSyncSource => ({
  listGroups: async () => (opts.listed ?? Object.keys(opts.groups ?? {}).map(Number)).map(id => ({ id })),
  getGroup: async (id: number) => {
    const detail = opts.groups?.[id];
    if (!detail) throw new Error(`group ${id} not found`);
    return detail;
  },
  listRules: async () => opts.rules ?? [],
});

describe('planReviewerSync', () => {
  test('adds a group the server lists for the first time', async () => {
    const detail = makeGroupDetail(1, [makeMember()]);
    const plan = await planReviewerSync(empty, makeSource({ groups: { 1: detail } }));

    expect(plan.failures).toEqual([]);
    expect(plan.upsertGroups).toEqual([storedGroup(detail)]);
    expect(plan.deleteGroupIds).toEqual([]);
  });

  test('always upserts the server-reported detail for an already-held group', async () => {
    const a = makeMember();
    const b = makeMember();
    const local: IReviewerStoreState = {
      groups: [storedGroup(makeGroupDetail(1, [a]))],
      rules: [],
    };
    const detail = makeGroupDetail(1, [a, b], { threshold: 2 });

    const plan = await planReviewerSync(local, makeSource({ groups: { 1: detail } }));

    expect(plan.upsertGroups).toEqual([storedGroup(detail)]);
  });

  test('deletes a locally-held group the server no longer lists', async () => {
    const local: IReviewerStoreState = {
      groups: [storedGroup(makeGroupDetail(1, [makeMember()]))],
      rules: [],
    };
    const plan = await planReviewerSync(local, makeSource({ groups: {} }));

    expect(plan.deleteGroupIds).toEqual([1]);
    expect(plan.upsertGroups).toEqual([]);
  });

  test('reports a group whose detail could not be fetched, without failing the rest', async () => {
    const detail2 = makeGroupDetail(2, [makeMember()]);
    const plan = await planReviewerSync(
      empty,
      makeSource({ listed: [1, 2], groups: { 2: detail2 } }),
    );

    expect(plan.failures).toMatchObject([{ groupId: 1 }]);
    expect(plan.upsertGroups).toEqual([storedGroup(detail2)]);
  });

  test('adds rules the server currently lists', async () => {
    const rule = makeRule(5, 1);
    const plan = await planReviewerSync(empty, makeSource({ groups: {}, rules: [rule] }));

    expect(plan.upsertRules).toEqual([
      {
        id: 5,
        groupId: 1,
        hederaId: '0.0.9',
        network: 'testnet',
        entityRole: null,
        transactionType: null,
      },
    ]);
  });

  test('deletes a locally-held rule the server no longer lists', async () => {
    const local: IReviewerStoreState = {
      groups: [],
      rules: [
        {
          id: 5,
          groupId: 1,
          hederaId: '0.0.9',
          network: 'testnet',
          entityRole: null,
          transactionType: null,
        },
      ],
    };
    const plan = await planReviewerSync(local, makeSource({ groups: {}, rules: [] }));

    expect(plan.deleteRuleIds).toEqual([5]);
  });
});
