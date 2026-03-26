import { describe, test, expect } from 'vitest';
import {
  AccountId,
  PrivateKey,
  TransferTransaction,
  TransactionId,
} from '@hashgraph/sdk';

import {
  generateTransactionV1ExportContent,
  generateTransactionV2ExportContent,
  generateTransactionExportFileName,
} from '@renderer/utils';

import type { ITransaction, ITransactionFull } from '@shared/interfaces';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildSdkTransaction = () =>
  new TransferTransaction()
    .setTransactionId(TransactionId.generate(new AccountId(0, 0, 1234)))
    .setNodeAccountIds([new AccountId(0, 0, 3)])
    .freeze();

const uint8ArrayToHex = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('hex');

const makeKey = () => PrivateKey.generateED25519();

const makeOrgTransaction = (overrides: Partial<ITransactionFull> = {}): ITransactionFull => {
  const tx = buildSdkTransaction();
  return {
    transactionBytes: uint8ArrayToHex(tx.toBytes()),
    creatorEmail: 'alice@example.com',
    description: 'Test transaction',
    createdAt: '2024-06-15T12:00:00.000Z',
    ...overrides,
  } as ITransactionFull;
};

// ---------------------------------------------------------------------------
// generateTransactionV1ExportContent
// ---------------------------------------------------------------------------

describe('generateTransactionV1ExportContent', () => {
  test('signs the transaction and returns signed bytes when no signatures present', async () => {
    const key = makeKey();
    const orgTx = makeOrgTransaction();

    const { transactionBytes } = await generateTransactionV1ExportContent(orgTx, key);

    // Signed bytes should differ from the original unsigned bytes
    const originalBytes = Buffer.from(orgTx.transactionBytes, 'hex');
    expect(Buffer.from(transactionBytes).equals(originalBytes)).toBe(false);
  });

  test('returns original bytes without re-signing when signatures already present', async () => {
    const key = makeKey();
    const tx = buildSdkTransaction();
    await tx.sign(key);

    const orgTx = makeOrgTransaction({
      transactionBytes: uint8ArrayToHex(tx.toBytes()),
    });

    const { transactionBytes } = await generateTransactionV1ExportContent(orgTx, key);

    expect(Buffer.from(transactionBytes).toString('hex')).toBe(orgTx.transactionBytes);
  });

  test('returns correct jsonContent with description from orgTransaction', async () => {
    const key = makeKey();
    const createdAt = '2024-06-15T12:00:00.000Z';
    const orgTx = makeOrgTransaction({
      description: 'My description',
      creatorEmail: 'bob@example.com',
      createdAt,
    });

    const { jsonContent } = await generateTransactionV1ExportContent(orgTx, key);
    const parsed = JSON.parse(jsonContent);

    expect(parsed.Author).toBe('bob@example.com');
    expect(parsed.Contents).toBe('My description');
    expect(parsed.Timestamp).toBe(format(new Date(createdAt), 'yyyy-MM-dd HH:mm:ss'));
  });

  test('falls back to defaultDescription when orgTransaction.description is empty', async () => {
    const key = makeKey();
    const orgTx = makeOrgTransaction({ description: '' });

    const { jsonContent } = await generateTransactionV1ExportContent(
      orgTx,
      key,
      'Default fallback',
    );
    const parsed = JSON.parse(jsonContent);

    expect(parsed.Contents).toBe('Default fallback');
  });

  test('falls back to empty string when both description and defaultDescription are absent', async () => {
    const key = makeKey();
    const orgTx = makeOrgTransaction({ description: '' });

    const { jsonContent } = await generateTransactionV1ExportContent(orgTx, key);
    const parsed = JSON.parse(jsonContent);

    expect(parsed.Contents).toBe('');
  });

  test('formats timestamp correctly', async () => {
    const key = makeKey();
    const createdAt = '2024-01-05T08:03:07.000Z';
    const orgTx = makeOrgTransaction({ createdAt });

    const { jsonContent } = await generateTransactionV1ExportContent(orgTx, key);
    const parsed = JSON.parse(jsonContent);

    expect(parsed.Timestamp).toBe(format(new Date(createdAt), 'yyyy-MM-dd HH:mm:ss'));
  });
});

// ---------------------------------------------------------------------------
// generateTransactionV2ExportContent
// ---------------------------------------------------------------------------

describe('generateTransactionV2ExportContent', () => {
  const makeTx = (overrides: Partial<ITransaction> = {}): ITransaction =>
    ({
      name: 'Transfer',
      description: 'A transfer',
      transactionBytes: 'deadbeef',
      creatorEmail: 'alice@example.com',
      ...overrides,
    }) as ITransaction;

  test('sets the network on the result', () => {
    const result = generateTransactionV2ExportContent([], 'testnet');
    expect(result.network).toBe('testnet');
  });

  test('returns empty items array when given no transactions', () => {
    const result = generateTransactionV2ExportContent([], 'mainnet');
    expect(result.items).toEqual([]);
  });

  test('maps each transaction to an item with correct fields', () => {
    const txs = [
      makeTx({ name: 'Tx1', description: 'Desc1', creatorEmail: 'a@a.com', transactionBytes: 'aa' }),
      makeTx({ name: 'Tx2', description: 'Desc2', creatorEmail: 'b@b.com', transactionBytes: 'bb' }),
    ];

    const result = generateTransactionV2ExportContent(txs, 'testnet');

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      name: 'Tx1',
      description: 'Desc1',
      transactionBytes: 'aa',
      creatorEmail: 'a@a.com',
    });
    expect(result.items[1]).toEqual({
      name: 'Tx2',
      description: 'Desc2',
      transactionBytes: 'bb',
      creatorEmail: 'b@b.com',
    });
  });

  test('does not include extra fields from the source transaction', () => {
    const tx = makeTx({ createdAt: '2024-01-01' } as any);
    const result = generateTransactionV2ExportContent([tx], 'mainnet');
    expect(result.items[0]).not.toHaveProperty('createdAt');
  });
});

// ---------------------------------------------------------------------------
// generateTransactionExportFileName
// ---------------------------------------------------------------------------

describe('generateTransactionExportFileName', () => {
  test('returns filename in expected format: epochSeconds_accountId_hash', () => {
    const tx = buildSdkTransaction();
    const bytes = tx.toBytes();
    const orgTx = { transactionBytes: uint8ArrayToHex(bytes) } as ITransaction;

    const result = generateTransactionExportFileName(orgTx);

    // Should match: digits_0.0.digits_digits
    expect(result).toMatch(/^\d+_\d+\.\d+\.\d+_-?\d+$/);
  });

  test('uses the validStart seconds from the transaction id', () => {
    const tx = buildSdkTransaction();
    const validStart = tx.transactionId!.validStart!;
    const orgTx = { transactionBytes: uint8ArrayToHex(tx.toBytes()) } as ITransaction;

    const result = generateTransactionExportFileName(orgTx);

    expect(result.startsWith(`${validStart.seconds}`)).toBe(true);
  });

  test('uses the accountId from the transaction id', () => {
    const tx = buildSdkTransaction();
    const accountId = tx.transactionId!.accountId!.toString();
    const orgTx = { transactionBytes: uint8ArrayToHex(tx.toBytes()) } as ITransaction;

    const result = generateTransactionExportFileName(orgTx);

    expect(result).toContain(accountId);
  });
});
