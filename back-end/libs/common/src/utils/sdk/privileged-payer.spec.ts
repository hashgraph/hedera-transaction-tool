import {
  AccountId,
  FileUpdateTransaction,
  FileId,
  TransactionId,
  Timestamp,
  PrivateKey,
  KeyList,
  TransferTransaction,
  Hbar,
  PublicKey,
} from '@hiero-ledger/sdk';

import {
  isPrivilegedFeePayer,
  getMaxTransactionSize,
  getMaxTransactionSizeForTransaction,
  getFeePayerFromSdkTransaction,
} from './privileged-payer';
import {
  MAX_TRANSACTION_BYTE_SIZE,
  MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
} from '../../database/entities/transaction.entity';
import {
  isTransactionBodyOverMaxSize,
  isTransactionOverMaxSize,
  smartCollate,
} from './transaction';

// Mock the @app/common barrel that transaction.ts imports `computeShortenedPublicKeyList`
// from. By default the auto-mock returns undefined, which crashes the for-of loop in
// smartCollate; we explicitly return [] so the loop is a no-op when the test exercises
// the size-too-big-after-pruning branch. Individual tests can override this mock with
// `mockComputeShortenedPublicKeyList.mockReturnValueOnce(...)` to exercise the
// re-add-signatures branch.
jest.mock('@app/common', () => ({
  __esModule: true,
  decode: jest.fn(),
  computeShortenedPublicKeyList: jest.fn().mockReturnValue([]),
}));
jest.mock('@app/common/utils');

// Pull the mock back out so individual tests can override its return value.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockComputeShortenedPublicKeyList = require('@app/common')
  .computeShortenedPublicKeyList as jest.Mock;

describe('HIP-1300 privileged fee payer detection', () => {
  describe('isPrivilegedFeePayer', () => {
    test('returns false for null', () => {
      expect(isPrivilegedFeePayer(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isPrivilegedFeePayer(undefined)).toBe(false);
    });

    test.each([
      // Treasury
      ['0.0.2', true],
      // Excluded gap (1-41)
      ['0.0.0', false],
      ['0.0.1', false],
      ['0.0.3', false],
      ['0.0.4', false],
      ['0.0.10', false],
      ['0.0.20', false],
      ['0.0.30', false],
      ['0.0.40', false],
      ['0.0.41', false],
      // Lower boundary of privileged range
      ['0.0.42', true],
      ['0.0.43', true],
      // Mid range
      ['0.0.50', true],
      ['0.0.55', true],
      ['0.0.100', true],
      ['0.0.500', true],
      // Upper boundary
      ['0.0.798', true],
      ['0.0.799', true],
      // Just above
      ['0.0.800', false],
      ['0.0.801', false],
      ['0.0.1000', false],
      ['0.0.10000', false],
      ['0.0.99999999', false],
    ])('%s -> %s', (id, expected) => {
      expect(isPrivilegedFeePayer(AccountId.fromString(id))).toBe(expected);
    });

    test('rejects non-zero shard even when num is in privileged range', () => {
      expect(isPrivilegedFeePayer(new AccountId(1, 0, 2))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(2, 0, 42))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(5, 0, 500))).toBe(false);
    });

    test('rejects non-zero realm even when num is in privileged range', () => {
      expect(isPrivilegedFeePayer(new AccountId(0, 1, 2))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(0, 5, 500))).toBe(false);
      expect(isPrivilegedFeePayer(new AccountId(0, 1, 799))).toBe(false);
    });

    test('rejects when both shard and realm are non-zero', () => {
      expect(isPrivilegedFeePayer(new AccountId(1, 1, 42))).toBe(false);
    });
  });

  describe('getMaxTransactionSize', () => {
    test('returns 6 KB for standard payers', () => {
      expect(getMaxTransactionSize(AccountId.fromString('0.0.1001'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
      expect(getMaxTransactionSize(AccountId.fromString('0.0.99999'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
      expect(getMaxTransactionSize(AccountId.fromString('0.0.41'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
      expect(getMaxTransactionSize(AccountId.fromString('0.0.800'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 128 KB for privileged payers', () => {
      expect(getMaxTransactionSize(AccountId.fromString('0.0.2'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
      expect(getMaxTransactionSize(AccountId.fromString('0.0.42'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
      expect(getMaxTransactionSize(AccountId.fromString('0.0.500'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
      expect(getMaxTransactionSize(AccountId.fromString('0.0.799'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 6 KB when fee payer is null', () => {
      expect(getMaxTransactionSize(null)).toBe(MAX_TRANSACTION_BYTE_SIZE);
    });

    test('returns 6 KB when fee payer is undefined', () => {
      expect(getMaxTransactionSize(undefined)).toBe(MAX_TRANSACTION_BYTE_SIZE);
    });

    test('exact byte values match the spec', () => {
      expect(getMaxTransactionSize(AccountId.fromString('0.0.2'))).toBe(131072);
      expect(getMaxTransactionSize(AccountId.fromString('0.0.10000'))).toBe(6144);
    });
  });

  describe('integration with isTransactionBodyOverMaxSize', () => {
    const buildTx = (payerNum: number, contentSize: number) => {
      const validStart = Timestamp.fromDate(new Date());
      return new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setContents(Buffer.alloc(contentSize, 0x41))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString(`0.0.${payerNum}`), validStart),
        );
    };

    test.each([
      [1, 7000, true], // standard payer, 7 KB → over 6 KB limit
      [41, 7000, true], // boundary just below privileged range
      [800, 7000, true], // boundary just above privileged range
      [1001, 7000, true], // far above privileged range
      [2, 7000, false], // treasury → allowed (under 128 KB)
      [42, 7000, false], // lower boundary, allowed
      [799, 7000, false], // upper boundary, allowed
      [500, 5000, false], // privileged, well under both limits
      [500, 140000, true], // privileged but over 128 KB → still rejected
    ])('payer 0.0.%i, %i bytes -> over limit = %s', (payer, size, expected) => {
      expect(isTransactionBodyOverMaxSize(buildTx(payer, size))).toBe(expected);
    });
  });

  describe('getFeePayerFromSdkTransaction', () => {
    test('extracts fee payer from a transaction id', () => {
      const validStart = Timestamp.fromDate(new Date());
      const tx = new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString('0.0.500'), validStart),
        );
      const payer = getFeePayerFromSdkTransaction(tx);
      expect(payer?.toString()).toBe('0.0.500');
    });
  });

  describe('getMaxTransactionSizeForTransaction', () => {
    const buildTx = (payer: string) => {
      const validStart = Timestamp.fromDate(new Date());
      return new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString(payer), validStart),
        );
    };

    test('returns 128 KB for tx paid by 0.0.2', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.2'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 128 KB for tx paid by lower bound 0.0.42', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.42'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 128 KB for tx paid by upper bound 0.0.799', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.799'))).toBe(
        MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 6 KB for tx paid by a normal account', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.9999'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 6 KB for tx paid by account just below the range', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.41'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 6 KB for tx paid by account just above the range', () => {
      expect(getMaxTransactionSizeForTransaction(buildTx('0.0.800'))).toBe(
        MAX_TRANSACTION_BYTE_SIZE,
      );
    });

    test('returns 6 KB defensively when transaction has no transactionId', () => {
      const tx = new FileUpdateTransaction().setFileId(FileId.fromString('0.0.150'));
      expect(getMaxTransactionSizeForTransaction(tx)).toBe(MAX_TRANSACTION_BYTE_SIZE);
    });
  });

  describe('isTransactionOverMaxSize (body + signatures via _makeRequestAsync)', () => {
    const buildFrozenTx = async (payerNum: number, contentSize: number) => {
      const validStart = Timestamp.fromDate(new Date());
      const tx = new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setContents(Buffer.alloc(contentSize, 0x41))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString(`0.0.${payerNum}`), validStart),
        )
        .setNodeAccountIds([AccountId.fromString('0.0.3')]);
      tx.freeze();
      return tx;
    };

    test('rejects 7 KB transaction with normal payer', async () => {
      const tx = await buildFrozenTx(1001, 7000);
      expect(await isTransactionOverMaxSize(tx)).toBe(true);
    });

    test('accepts 7 KB transaction with treasury payer', async () => {
      const tx = await buildFrozenTx(2, 7000);
      expect(await isTransactionOverMaxSize(tx)).toBe(false);
    });

    test('accepts 7 KB transaction with lower-bound privileged payer 0.0.42', async () => {
      const tx = await buildFrozenTx(42, 7000);
      expect(await isTransactionOverMaxSize(tx)).toBe(false);
    });

    test('accepts 7 KB transaction with upper-bound privileged payer 0.0.799', async () => {
      const tx = await buildFrozenTx(799, 7000);
      expect(await isTransactionOverMaxSize(tx)).toBe(false);
    });

    test('rejects 140 KB transaction even with privileged payer (over 128 KB)', async () => {
      const tx = await buildFrozenTx(2, 140000);
      expect(await isTransactionOverMaxSize(tx)).toBe(true);
    });

    test('accepts small transaction with normal payer', async () => {
      const tx = await buildFrozenTx(1001, 100);
      expect(await isTransactionOverMaxSize(tx)).toBe(false);
    });

    test('accepts 7 KB tx with privileged payer even after adding a signature', async () => {
      const tx = await buildFrozenTx(2, 7000);
      const key = PrivateKey.generateED25519();
      await tx.sign(key);
      expect(await isTransactionOverMaxSize(tx)).toBe(false);
    });

    test('boundary: payer 0.0.41 (one below range) uses standard limit', async () => {
      const tx = await buildFrozenTx(41, 7000);
      expect(await isTransactionOverMaxSize(tx)).toBe(true);
    });

    test('boundary: payer 0.0.800 (one above range) uses standard limit', async () => {
      const tx = await buildFrozenTx(800, 7000);
      expect(await isTransactionOverMaxSize(tx)).toBe(true);
    });
  });

  describe('isTransactionBodyOverMaxSize boundary matrix', () => {
    const buildTx = (payerNum: number, contentSize: number) => {
      const validStart = Timestamp.fromDate(new Date());
      return new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setContents(Buffer.alloc(contentSize, 0x41))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString(`0.0.${payerNum}`), validStart),
        );
    };

    test.each([
      // [payer, content size, expected isOver]
      [1, 7000, true],
      [1, 5000, false],
      [41, 7000, true],
      [41, 5000, false],
      [800, 7000, true],
      [800, 5000, false],
      [1001, 7000, true],
      [10000, 7000, true],
      [2, 7000, false], // treasury allows 7K
      [2, 5000, false],
      [2, 130000, false], // treasury allows up to 128K
      [2, 140000, true], // treasury rejects above 128K
      [42, 7000, false], // lower bound
      [42, 130000, false],
      [42, 140000, true],
      [500, 7000, false],
      [500, 130000, false],
      [500, 140000, true],
      [799, 7000, false], // upper bound
      [799, 130000, false],
      [799, 140000, true],
    ])(
      'payer 0.0.%i with %i bytes -> over limit = %s',
      (payer, size, expected) => {
        expect(isTransactionBodyOverMaxSize(buildTx(payer, size))).toBe(expected);
      },
    );

    test('returns false at exact standard boundary (6144 bytes content)', () => {
      // Body is contents + envelope overhead, so content of just under
      // MAX_TRANSACTION_BYTE_SIZE will not exceed it.
      const tx = buildTx(1001, 5500);
      expect(isTransactionBodyOverMaxSize(tx)).toBe(false);
    });

    test('returns false for empty contents with normal payer', () => {
      const tx = buildTx(1001, 0);
      expect(isTransactionBodyOverMaxSize(tx)).toBe(false);
    });

    test('returns false for empty contents with privileged payer', () => {
      const tx = buildTx(2, 0);
      expect(isTransactionBodyOverMaxSize(tx)).toBe(false);
    });

    test('non-File transaction (TransferTransaction) is checked correctly', () => {
      const validStart = Timestamp.fromDate(new Date());
      const transfer = new TransferTransaction()
        .addHbarTransfer(AccountId.fromString('0.0.1001'), Hbar.fromTinybars(-100))
        .addHbarTransfer(AccountId.fromString('0.0.1002'), Hbar.fromTinybars(100))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString('0.0.1001'), validStart),
        );
      // A small transfer body is well under both limits
      expect(isTransactionBodyOverMaxSize(transfer)).toBe(false);
    });
  });

  describe('smartCollate (HIP-1300 fee-payer awareness)', () => {
    type FakeEntity = { transactionBytes: Uint8Array };
    const buildTransactionEntity = async (
      payerNum: number,
      contentSize: number,
      privateKey?: PrivateKey,
    ): Promise<FakeEntity> => {
      const validStart = Timestamp.fromDate(new Date());
      const tx = new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setContents(Buffer.alloc(contentSize, 0x41))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString(`0.0.${payerNum}`), validStart),
        )
        .setNodeAccountIds([AccountId.fromString('0.0.3')]);
      tx.freeze();
      if (privateKey) {
        await tx.sign(privateKey);
      }
      return { transactionBytes: tx.toBytes() };
    };
    // Cast to the entity type smartCollate expects without exposing `any`
    // throughout each test body.
    const asEntity = (e: FakeEntity) => e as unknown as Parameters<typeof smartCollate>[0];

    test('returns the SDK transaction when small and within limits (normal payer)', async () => {
      const entity = await buildTransactionEntity(1001, 100);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).not.toBeNull();
    });

    test('returns the SDK transaction unchanged for 7 KB with privileged payer', async () => {
      // HIP-1300: should NOT enter the signature-stripping branch because the
      // transaction is well under the privileged 128 KB limit.
      const entity = await buildTransactionEntity(2, 7000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).not.toBeNull();
    });

    test('returns null when 140 KB even with privileged payer (over 128 KB)', async () => {
      const entity = await buildTransactionEntity(2, 140000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).toBeNull();
    });

    test('returns null when 7 KB with normal payer and signature pruning cannot save it', async () => {
      // Normal payer can't accept 7 KB; with empty key list, pruning produces
      // an empty signature set but body is still over the 6 KB limit → null.
      const entity = await buildTransactionEntity(1001, 7000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).toBeNull();
    });

    test('returns the SDK transaction for treasury payer at exactly 128 KB - small', async () => {
      // Just under the privileged limit
      const entity = await buildTransactionEntity(2, 130000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).not.toBeNull();
    });

    test('returns the SDK transaction for upper-bound privileged payer 0.0.799 with 100 KB', async () => {
      const entity = await buildTransactionEntity(799, 100000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).not.toBeNull();
    });

    test('returns null for boundary payer 0.0.41 with 7 KB (standard limit applies)', async () => {
      const entity = await buildTransactionEntity(41, 7000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).toBeNull();
    });

    test('returns null for boundary payer 0.0.800 with 7 KB (standard limit applies)', async () => {
      const entity = await buildTransactionEntity(800, 7000);
      const result = await smartCollate(asEntity(entity), new KeyList());
      expect(result).toBeNull();
    });

    test('exercises the signature re-add branch when shortened key list is non-empty', async () => {
      // Build a tx that is over-size with signatures attached, then have
      // computeShortenedPublicKeyList return one of those public keys so the
      // for-loop in smartCollate adds it back.
      const key = PrivateKey.generateED25519();
      const validStart = Timestamp.fromDate(new Date());
      const tx = new FileUpdateTransaction()
        .setFileId(FileId.fromString('0.0.150'))
        .setContents(Buffer.alloc(7000, 0x41))
        .setTransactionId(
          TransactionId.withValidStart(AccountId.fromString('0.0.1001'), validStart),
        )
        .setNodeAccountIds([AccountId.fromString('0.0.3')]);
      tx.freeze();
      await tx.sign(key);
      const entity: FakeEntity = { transactionBytes: tx.toBytes() };

      // Return the actual public key that was used to sign so addSignature
      // finds a matching entry in the SignatureMap.
      mockComputeShortenedPublicKeyList.mockReturnValueOnce([key.publicKey as PublicKey]);

      const result = await smartCollate(asEntity(entity), new KeyList());
      // Even after re-adding the signature, the body is still > 6 KB, so
      // smartCollate returns null. This test's purpose is the branch coverage
      // of the for-loop on line 305-306 of transaction.ts.
      expect(result).toBeNull();
      expect(mockComputeShortenedPublicKeyList).toHaveBeenCalled();
    });
  });
});
