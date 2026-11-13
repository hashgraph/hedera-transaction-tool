import type { IReviewerGroupDetail, IReviewerRule, IStoredReviewerGroup } from '@shared/interfaces';

let nextId = 1;

export interface TestMember {
  userId: number;
  userKeyId: number;
  publicKey: string;
}

export const makeMember = (): TestMember => {
  const id = nextId++;
  return { userId: id, userKeyId: 100 + id, publicKey: `pub-${id}` };
};

export const makeGroupDetail = (
  id: number,
  members: TestMember[],
  overrides: Partial<IReviewerGroupDetail> = {},
): IReviewerGroupDetail => ({
  id,
  name: `Group ${id}`,
  description: null,
  threshold: 1,
  createdAt: '',
  updatedAt: '',
  members: members.map((m, i) => ({ id: i + 1, groupId: id, ...m, createdAt: '' })),
  rules: [],
  ...overrides,
});

export const makeRule = (id: number, groupId: number, hederaId = '0.0.9'): IReviewerRule => ({
  id,
  groupId,
  hederaId,
  network: 'testnet',
  entityRole: null,
  transactionType: null,
  createdAt: '',
});

export const storedGroup = (detail: IReviewerGroupDetail): IStoredReviewerGroup => ({
  id: detail.id,
  name: detail.name,
  description: detail.description,
  threshold: detail.threshold,
  members: detail.members.map(m => ({
    userId: m.userId,
    userKeyId: m.userKeyId,
    publicKey: m.publicKey,
  })),
});
