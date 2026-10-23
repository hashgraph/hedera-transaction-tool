import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import type { ITransaction } from '@shared/interfaces';

import {
  getCreatorSignatureStatus,
  getGroupCreatorSignatureStatus,
  worstCreatorSignatureStatus,
} from '@renderer/utils';
import { TransactionStatus } from '@shared/interfaces';
import type { IGroup } from '@renderer/services/organization';

const contactKeys: { id: number; publicKey: string }[] = [];

vi.mock('@renderer/stores/storeContacts', () => ({
  default: () => ({ contacts: [{ userKeys: contactKeys }] }),
}));

const creatorKey = PrivateKey.generateED25519();
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const client = Client.forTestnet();
const signedBytes = new AccountCreateTransaction()
  .setKeyWithoutAlias(creatorKey.publicKey)
  .setInitialBalance(new Hbar(1))
  .setTransactionId(
    TransactionId.withValidStart(AccountId.fromString('0.0.1234'), Timestamp.fromDate(new Date())),
  )
  .freezeWith(client)
  .toBytes();
client.close();

const buildTx = (overrides: Partial<ITransaction> = {}) =>
  ({
    transactionId: '0.0.1234@1.1',
    creatorKeyId: 1,
    transactionBytes: hex(signedBytes),
    unsignedTransactionBytes: hex(signedBytes),
    signature: hex(creatorKey.sign(signedBytes)),
    ...overrides,
  }) as ITransaction;

const creatorPublicKey = { id: 1, publicKey: creatorKey.publicKey.toStringRaw() };

describe('getCreatorSignatureStatus', () => {
  beforeEach(() => {
    contactKeys.length = 0;
  });

  test('is verified when the signature matches an own key', () => {
    expect(getCreatorSignatureStatus(buildTx(), [creatorPublicKey])).toBe('verified');
  });

  test('falls back to contacts for the creator key', () => {
    contactKeys.push(creatorPublicKey);

    expect(getCreatorSignatureStatus(buildTx(), [])).toBe('verified');
  });

  test('is creator-unavailable when the key is in neither own keys nor contacts', () => {
    contactKeys.push({ ...creatorPublicKey, id: 99 });

    expect(getCreatorSignatureStatus(buildTx(), [])).toBe('creator-unavailable');
  });

  test('is unverifiable when the signature is from another key', () => {
    const tx = buildTx({ signature: hex(PrivateKey.generateED25519().sign(signedBytes)) });

    expect(getCreatorSignatureStatus(tx, [creatorPublicKey])).toBe('unverifiable');
  });

  test('is unverifiable when the data cannot be parsed', () => {
    expect(getCreatorSignatureStatus(buildTx({ transactionBytes: 'zz' }), [creatorPublicKey])).toBe(
      'unverifiable',
    );
  });

  test.each(['signature', 'unsignedTransactionBytes'] as const)(
    "returns 'data-missing' when %s is missing",
    field => {
      const tx = buildTx({ [field]: undefined });

      expect(getCreatorSignatureStatus(tx, [creatorPublicKey])).toBe('data-missing');
    },
  );
});

describe('worstCreatorSignatureStatus', () => {
  test("is 'verified' when there are no statuses", () => {
    expect(worstCreatorSignatureStatus([])).toBe('verified');
  });

  test.each([
    [['verified', 'creator-unavailable'], 'creator-unavailable'],
    [['creator-unavailable', 'unverifiable', 'verified'], 'unverifiable'],
    [['unverifiable', 'data-missing', 'creator-unavailable'], 'data-missing'],
    [['verified', 'verified'], 'verified'],
  ] as const)('%j -> %s', (statuses, expected) => {
    expect(worstCreatorSignatureStatus([...statuses])).toBe(expected);
  });
});

describe('getGroupCreatorSignatureStatus', () => {
  const item = (status: TransactionStatus, overrides: Partial<ITransaction> = {}) => ({
    transaction: { ...buildTx(overrides), status },
  });
  const group = (...items: ReturnType<typeof item>[]) =>
    ({ groupItems: items }) as unknown as IGroup;

  beforeEach(() => {
    contactKeys.length = 0;
  });

  test('is verified when every signable transaction verifies', () => {
    const g = group(
      item(TransactionStatus.WAITING_FOR_SIGNATURES),
      item(TransactionStatus.WAITING_FOR_SIGNATURES),
    );

    expect(getGroupCreatorSignatureStatus(g, [creatorPublicKey])).toBe('verified');
  });

  test('reports the worst status among signable transactions', () => {
    const g = group(
      item(TransactionStatus.WAITING_FOR_SIGNATURES),
      item(TransactionStatus.WAITING_FOR_SIGNATURES, { signature: undefined }),
    );

    expect(getGroupCreatorSignatureStatus(g, [creatorPublicKey])).toBe('data-missing');
  });

  test('ignores transactions that can no longer be signed', () => {
    const g = group(
      item(TransactionStatus.WAITING_FOR_SIGNATURES),
      item(TransactionStatus.EXECUTED, { signature: undefined }),
    );

    expect(getGroupCreatorSignatureStatus(g, [creatorPublicKey])).toBe('verified');
  });
});
