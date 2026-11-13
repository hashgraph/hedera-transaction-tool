import { describe, expect, test, vi, beforeEach } from 'vitest';
import { AccountCreateTransaction, AccountId, Client, Hbar, PrivateKey, Timestamp, TransactionId } from '@hiero-ledger/sdk';

import type { ITransactionFull } from '@shared/interfaces';
import { buildReviewAttestationMessage } from '@shared/utils/reviewerReviewVerification';

import { uint8ToHex } from '@renderer/utils';
import { computeTransactionHash } from '@renderer/utils/sdk';
import { verifyTransactionReviews } from '@renderer/services/reviewerReviewService';

const mocks = vi.hoisted(() => ({ getReviewerState: vi.fn() }));
vi.mock('@renderer/services/reviewerStoreService', () => ({
  getReviewerState: mocks.getReviewerState,
}));

const buildFrozenBytes = () => {
  const client = Client.forTestnet();
  const bytes = new AccountCreateTransaction()
    .setKeyWithoutAlias(PrivateKey.generateED25519().publicKey)
    .setInitialBalance(new Hbar(1))
    .setTransactionId(
      TransactionId.withValidStart(AccountId.fromString('0.0.1234'), Timestamp.fromDate(new Date())),
    )
    .freezeWith(client)
    .toBytes();
  client.close();
  return bytes;
};

const baseTransaction = {
  id: 1,
  name: 'Tx',
  transactionId: '0.0.1234@1700000000.000000000',
  type: 'ACCOUNT_CREATE',
  description: '',
  transactionBytes: '',
  status: 'READY_FOR_REVIEW',
  signature: '',
  validStart: '',
  isManual: false,
  createdAt: '',
  updatedAt: '',
  mirrorNetwork: 'testnet',
  creatorKeyId: 1,
  creatorId: 1,
  creatorEmail: 'a@b.com',
  signers: [],
  observers: [],
};

const makeTransaction = (overrides: Partial<ITransactionFull> = {}): ITransactionFull =>
  ({ ...baseTransaction, ...overrides }) as ITransactionFull;

describe('verifyTransactionReviews', () => {
  beforeEach(() => vi.resetAllMocks());

  test('returns null when unsignedTransactionBytes is missing', async () => {
    const transaction = makeTransaction({ unsignedTransactionBytes: undefined });
    expect(await verifyTransactionReviews(transaction, 'org-1')).toBeNull();
    expect(mocks.getReviewerState).not.toHaveBeenCalled();
  });

  test('returns null when the bytes are not frozen (can\'t compute a hash)', async () => {
    const unfrozen = new AccountCreateTransaction()
      .setKeyWithoutAlias(PrivateKey.generateED25519().publicKey)
      .toBytes();
    const transaction = makeTransaction({ unsignedTransactionBytes: uint8ToHex(unfrozen) });
    expect(await verifyTransactionReviews(transaction, 'org-1')).toBeNull();
    expect(mocks.getReviewerState).not.toHaveBeenCalled();
  });

  test('verifies each member against current local-store keys', async () => {
    const frozenBytes = buildFrozenBytes();
    const transactionHash = await computeTransactionHash(frozenBytes);
    expect(transactionHash).not.toBeNull();

    const reviewer = PrivateKey.generateED25519();
    const departedReviewer = PrivateKey.generateED25519();

    mocks.getReviewerState.mockResolvedValue({
      groups: [
        {
          members: [{ userId: 1, userKeyId: 10, publicKey: reviewer.publicKey.toStringRaw() }],
        },
      ],
      rules: [],
    });

    const sign = (key: typeof reviewer, accepted: boolean, note: string | null) =>
      Buffer.from(
        key.sign(buildReviewAttestationMessage(1, accepted, note, transactionHash as string)),
      ).toString('hex');

    const transaction = makeTransaction({
      id: 1,
      unsignedTransactionBytes: uint8ToHex(frozenBytes),
      reviewerLists: [
        {
          id: 100,
          name: null,
          description: null,
          threshold: 1,
          members: [
            {
              userId: 1,
              userKeyId: 10,
              accepted: true,
              note: 'lgtm',
              signature: sign(reviewer, true, 'lgtm'),
              actionedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              userId: 2,
              userKeyId: 20,
              accepted: true,
              note: null,
              signature: sign(departedReviewer, true, null),
              actionedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              userId: 3,
              userKeyId: 10,
              accepted: false,
              note: null,
              signature: sign(reviewer, true, null), // signed for a different vote
              actionedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              userId: 4,
              userKeyId: null,
              accepted: null,
              note: null,
              signature: null,
              actionedAt: null,
            },
          ],
        },
      ],
    });

    const result = await verifyTransactionReviews(transaction, 'org-1');

    expect(mocks.getReviewerState).toHaveBeenCalledWith('org-1');
    expect(result).toEqual([
      {
        listId: 100,
        members: [
          { userId: 1, status: 'verified' },
          { userId: 2, status: 'unverifiable' },
          { userId: 3, status: 'invalid' },
          { userId: 4, status: null },
        ],
      },
    ]);
  });
});
