// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { type ITransaction, TransactionStatus, BackEndTransactionType } from '@shared/interfaces';
import type { ConnectedOrganization, LoggedInOrganization } from '@renderer/types';
import type { AppCache } from '@renderer/caches/AppCache';

const mockFlattenKeyList = vi.fn();

vi.mock('@renderer/utils/transactionSignatureModels/../../services/keyPairService', () => ({
  flattenKeyList: (...args: unknown[]) => mockFlattenKeyList(...args),
}));

vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: vi.fn(),
}));

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    Transaction: {
      ...actual.Transaction,
      fromBytes: vi.fn(() => ({ _signerPublicKeys: [] })),
    },
  };
});

vi.mock('@renderer/utils', () => ({
  hexToUint8Array: vi.fn(() => new Uint8Array([0xaa, 0xbb])),
}));

import { isSignableTransaction } from '@renderer/utils/transactionSignatureModels';

const MIRROR_NODE_LINK = 'https://testnet.mirrornode.hedera.com';
const USER_PUBLIC_KEY = 'abc123';

const buildTransaction = (status: TransactionStatus): ITransaction => ({
  id: 1,
  name: 'Test Transaction',
  transactionId: '0.0.1234@1234567890.000000000',
  type: BackEndTransactionType.ACCOUNT_CREATE,
  description: 'test',
  transactionBytes: 'aabbccdd',
  status,
  signature: '',
  validStart: new Date().toISOString(),
  isManual: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mirrorNetwork: 'testnet',
  creatorKeyId: 1,
  creatorId: 1,
  creatorEmail: 'test@test.com',
});

const buildOrganization = (): ConnectedOrganization & LoggedInOrganization =>
  ({
    isLoading: false,
    isServerActive: true,
    loginRequired: false,
    userId: 1,
    email: 'test@test.com',
    admin: false,
    isPasswordTemporary: false,
    userKeys: [{ id: 1, userId: 1, publicKey: USER_PUBLIC_KEY }],
    secretHashes: [],
  }) as unknown as ConnectedOrganization & LoggedInOrganization;

const buildAppCache = (signatureKeys: unknown[] = []): AppCache =>
  ({
    computeSignatureKey: vi.fn().mockResolvedValue({ signatureKeys }),
  }) as unknown as AppCache;

describe('isSignableTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupUserCanSign = () => {
    const sentinelKey = { toStringRaw: () => USER_PUBLIC_KEY };
    mockFlattenKeyList.mockReturnValue([sentinelKey]);
    return buildAppCache([sentinelKey]);
  };

  const setupUserCannotSign = () => {
    mockFlattenKeyList.mockReturnValue([]);
    return buildAppCache([]);
  };

  test('returns true for WAITING_FOR_SIGNATURES when user has keys to sign', async () => {
    const appCache = setupUserCanSign();
    const tx = buildTransaction(TransactionStatus.WAITING_FOR_SIGNATURES);

    const result = await isSignableTransaction(tx, MIRROR_NODE_LINK, appCache, buildOrganization());

    expect(result).toBe(true);
  });

  test('returns true for WAITING_FOR_EXECUTION when user has keys to sign', async () => {
    const appCache = setupUserCanSign();
    const tx = buildTransaction(TransactionStatus.WAITING_FOR_EXECUTION);

    const result = await isSignableTransaction(tx, MIRROR_NODE_LINK, appCache, buildOrganization());

    expect(result).toBe(true);
  });


  test('returns false for WAITING_FOR_SIGNATURES when user has no keys to sign', async () => {
    const appCache = setupUserCannotSign();
    const tx = buildTransaction(TransactionStatus.WAITING_FOR_SIGNATURES);

    const result = await isSignableTransaction(tx, MIRROR_NODE_LINK, appCache, buildOrganization());

    expect(result).toBe(false);
  });

  test('returns false for WAITING_FOR_EXECUTION when user has no keys to sign', async () => {
    const appCache = setupUserCannotSign();
    const tx = buildTransaction(TransactionStatus.WAITING_FOR_EXECUTION);

    const result = await isSignableTransaction(tx, MIRROR_NODE_LINK, appCache, buildOrganization());

    expect(result).toBe(false);
  });

  test.each([
    TransactionStatus.NEW,
    TransactionStatus.EXECUTED,
    TransactionStatus.FAILED,
    TransactionStatus.EXPIRED,
    TransactionStatus.CANCELED,
    TransactionStatus.REJECTED,
    TransactionStatus.ARCHIVED,
  ])('returns false for %s status regardless of user keys', async status => {
    const appCache = setupUserCanSign();
    const tx = buildTransaction(status);

    const result = await isSignableTransaction(tx, MIRROR_NODE_LINK, appCache, buildOrganization());

    expect(result).toBe(false);
  });

  test('returns false when SDK fromBytes throws', async () => {
    const { Transaction } = await import('@hiero-ledger/sdk');
    vi.mocked(Transaction.fromBytes).mockImplementationOnce(() => {
      throw new Error('Invalid transaction bytes');
    });

    const tx = buildTransaction(TransactionStatus.WAITING_FOR_SIGNATURES);
    const result = await isSignableTransaction(
      tx, MIRROR_NODE_LINK, buildAppCache(), buildOrganization(),
    );

    expect(result).toBe(false);
  });

  test('returns false when usersPublicRequiredToSign rejects (computeSignatureKey fails)', async () => {
    const appCache = {
      computeSignatureKey: vi.fn().mockRejectedValue(new Error('Network error')),
    } as unknown as AppCache;

    const tx = buildTransaction(TransactionStatus.WAITING_FOR_EXECUTION);
    const result = await isSignableTransaction(tx, MIRROR_NODE_LINK, appCache, buildOrganization());

    expect(result).toBe(false);
  });
});
