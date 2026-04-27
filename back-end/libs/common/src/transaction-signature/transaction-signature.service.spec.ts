import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountId,
  EvmAddress,
  FileId,
  Hbar,
  Key,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  ServiceEndpoint,
  Transaction as SDKTransaction,
} from '@hiero-ledger/sdk';

import { TransactionSignatureService } from './transaction-signature.service';
import { AccountCacheService } from '@app/common/transaction-signature/account-cache.service';
import { NodeCacheService } from '@app/common/transaction-signature/node-cache.service';
import TransactionFactory from '@app/common/transaction-signature/model/transaction-factory';
import { COUNCIL_ACCOUNTS } from '@app/common/constants';
import { Transaction } from '@entities';
import { AccountInfoParsed, NodeInfoParsed } from '@app/common/types';
import { TimestampRange } from '@app/common/schemas';

// ---------------------------------------------------------------------------
// Helpers / shared mocks
// ---------------------------------------------------------------------------

const mockKey = (label: string) => ({ __key: label });

const makeAccountInfo = (
  keyLabel: string,
  receiverSignatureRequired = false,
): AccountInfoParsed => ({
  accountId: { toString: () => '0.0.100' } as unknown as AccountId,
  alias: null,
  balance: { toTinybars: () => 0 } as unknown as Hbar,
  declineReward: false,
  deleted: false,
  ethereumNonce: 0,
  evmAddress: {} as unknown as EvmAddress,
  createdTimestamp: null,
  expiryTimestamp: null,
  key: mockKey(keyLabel) as unknown as Key,
  maxAutomaticTokenAssociations: null,
  memo: null,
  pendingRewards: { toTinybars: () => 0 } as unknown as Hbar,
  receiverSignatureRequired,
  stakedAccountId: null,
  stakedNodeId: null,
  autoRenewPeriod: null,
});

const makeNodeInfo = (
  adminKeyLabel: string | null,
  nodeAccountId: AccountId | null = {
    toString: () => '0.0.50',
    equals: (other: any) => other?.toString?.() === '0.0.50',
  } as unknown as AccountId,
): NodeInfoParsed => ({
  admin_key: adminKeyLabel ? (mockKey(adminKeyLabel) as unknown as Key) : null,
  description: null,
  file_id: null as unknown as FileId,
  memo: null,
  node_id: null,
  node_account_id: nodeAccountId,
  node_cert_hash: null,
  public_key: null,
  service_endpoints: [],
  timestamp: null as unknown as TimestampRange,
  max_stake: null as unknown as Hbar,
  min_stake: null as unknown as Hbar,
  stake: null as unknown as Hbar,
  stake_not_rewarded: null as unknown as Hbar,
  stake_rewarded: null as unknown as Hbar,
  staking_period: null as unknown as TimestampRange,
  reward_rate_start: null as unknown as Hbar,
  decline_reward: null,
  grpc_web_proxy_endpoint: null as unknown as ServiceEndpoint,
});

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    transactionBytes: Buffer.from('fake-bytes'),
    ...overrides,
  } as unknown as Transaction);

function buildTransactionModel(overrides: any = {}) {
  return {
    getFeePayerAccountId: jest.fn().mockReturnValue({ toString: () => '0.0.100' }),
    getSigningAccounts: jest.fn().mockReturnValue(new Set<string>()),
    getReceiverAccounts: jest.fn().mockReturnValue(new Set<string>()),
    getNewKeys: jest.fn().mockReturnValue([]),
    getNodeId: jest.fn().mockReturnValue(null),
    ...overrides,
  };
}

const makeTransactionModel = (
  overrides: Partial<ReturnType<typeof buildTransactionModel>> = {},
) => buildTransactionModel(overrides);

// ---------------------------------------------------------------------------
// Module bootstrap helper
// ---------------------------------------------------------------------------

async function createService() {
  const accountCacheMock = {
    getAccountInfoForTransaction: jest.fn(),
  } as jest.Mocked<Pick<AccountCacheService, 'getAccountInfoForTransaction'>>;

  const nodeCacheMock = {
    getNodeInfoForTransaction: jest.fn(),
  } as jest.Mocked<Pick<NodeCacheService, 'getNodeInfoForTransaction'>>;

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TransactionSignatureService,
      { provide: AccountCacheService, useValue: accountCacheMock },
      { provide: NodeCacheService, useValue: nodeCacheMock },
    ],
  }).compile();

  return {
    service: module.get<TransactionSignatureService>(TransactionSignatureService),
    accountCacheMock,
    nodeCacheMock,
  };
}

// ---------------------------------------------------------------------------
// SDK mocks
// ---------------------------------------------------------------------------

jest.mock('@hiero-ledger/sdk', () => {
  const actual = jest.requireActual('@hiero-ledger/sdk');
  class MockKeyList {
    private items: any[] = [];
    private threshold: number | undefined;

    push(...args: any[]) {
      this.items.push(...args);
    }
    setThreshold(t: number) {
      this.threshold = t;
    }
    getThreshold() {
      return this.threshold;
    }
    getItems() {
      return this.items;
    }
    toArray() {
      return this.items;
    }
  }

  return {
    ...actual,
    KeyList: MockKeyList,
    Transaction: { fromBytes: jest.fn() },
    AccountId: {
      fromString: jest.fn((s: string) => ({
        toString: () => s,
        equals: (other: any) => other?.toString?.() === s,
      })),
    },
    NodeDeleteTransaction: class NodeDeleteTransaction {},
    NodeUpdateTransaction: class NodeUpdateTransaction {
      accountId: any = null;
      adminKey: any = null;
      description: any = null;
      certificateHash: any = null;
      gossipCaCertificate: any = null;
      serviceEndpoints: any = null;
      gossipEndpoints: any = null;
      grpcWebProxyEndpoint: any = null;
      declineReward: any = null;
    },
  };
});

jest.mock('@app/common/transaction-signature/model/transaction-factory');

// ---------------------------------------------------------------------------
// Convenience type alias so casts stay concise
// ---------------------------------------------------------------------------

type AsMockKeyList = { getItems: () => any[] };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionSignatureService', () => {
  let service: TransactionSignatureService;
  let accountCacheMock: jest.Mocked<AccountCacheService>;
  let nodeCacheMock: jest.Mocked<NodeCacheService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const setup = await createService();
    service = setup.service;
    accountCacheMock = setup.accountCacheMock as jest.Mocked<AccountCacheService>;
    nodeCacheMock = setup.nodeCacheMock as jest.Mocked<NodeCacheService>;
  });

  // -------------------------------------------------------------------------
  // computeSignatureKey — high-level integration
  // -------------------------------------------------------------------------

  describe('computeSignatureKey', () => {
    it('returns a KeyList with only the fee payer key when no other accounts or node', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(makeTransactionModel());
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      expect(items).toHaveLength(1);
      expect(items).toContainEqual(mockKey('fee-payer-key'));
    });

    it('includes signing account keys', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({
          getSigningAccounts: jest.fn().mockReturnValue(new Set(['0.0.200', '0.0.201'])),
        }),
      );
      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('signer-200-key'))
        .mockResolvedValueOnce(makeAccountInfo('signer-201-key'));

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      expect(items).toHaveLength(3);
      expect(items).toContainEqual(mockKey('signer-200-key'));
      expect(items).toContainEqual(mockKey('signer-201-key'));
    });

    it('includes receiver key when receiverSignatureRequired is true', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({
          getReceiverAccounts: jest.fn().mockReturnValue(new Set(['0.0.300'])),
        }),
      );
      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('receiver-key', true));

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(
        mockKey('receiver-key'),
      );
    });

    it('excludes receiver key when receiverSignatureRequired is false and showAll is false', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({
          getReceiverAccounts: jest.fn().mockReturnValue(new Set(['0.0.300'])),
        }),
      );
      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('receiver-key', false));

      const result = await service.computeSignatureKey(makeTransaction(), false);

      expect((result as unknown as AsMockKeyList).getItems()).not.toContainEqual(
        mockKey('receiver-key'),
      );
    });

    it('includes receiver key when showAll is true even if receiverSignatureRequired is false', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({
          getReceiverAccounts: jest.fn().mockReturnValue(new Set(['0.0.300'])),
        }),
      );
      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('receiver-key', false));

      const result = await service.computeSignatureKey(makeTransaction(), true);

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(
        mockKey('receiver-key'),
      );
    });

    it('includes newKeys from the transaction model', async () => {
      const newKey1 = mockKey('new-key-1');
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNewKeys: jest.fn().mockReturnValue([newKey1]) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(newKey1);
    });

    it('does NOT call addNodeKeys when nodeId is null', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(null) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );

      await service.computeSignatureKey(makeTransaction());

      expect(nodeCacheMock.getNodeInfoForTransaction).not.toHaveBeenCalled();
    });

    it('calls addNodeKeys when nodeId is provided', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(5) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );
      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(null);

      await service.computeSignatureKey(makeTransaction());

      expect(nodeCacheMock.getNodeInfoForTransaction).toHaveBeenCalledWith(expect.anything(), 5);
    });
  });

  // -------------------------------------------------------------------------
  // addFeePayerKey — error handling
  // -------------------------------------------------------------------------

  describe('fee payer error handling', () => {
    it('gracefully handles an error from accountCacheService for the fee payer', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(makeTransactionModel());
      accountCacheMock.getAccountInfoForTransaction.mockRejectedValue(new Error('cache miss'));

      const result = await service.computeSignatureKey(makeTransaction());

      expect(result).toBeDefined();
    });

    it('handles null accountInfo for fee payer without crashing', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(makeTransactionModel());
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        null as unknown as AccountInfoParsed,
      );

      const result = await service.computeSignatureKey(makeTransaction());

      expect(result).toBeDefined();
      expect((result as unknown as AsMockKeyList).getItems()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // addSigningAccountKeys — error handling
  // -------------------------------------------------------------------------

  describe('signing account error handling', () => {
    it('continues processing remaining signing accounts after one fails', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({
          getSigningAccounts: jest.fn().mockReturnValue(new Set(['0.0.200', '0.0.201'])),
        }),
      );
      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockRejectedValueOnce(new Error('error for 200'))
        .mockResolvedValueOnce(makeAccountInfo('signer-201-key'));

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      expect(items).toContainEqual(mockKey('signer-201-key'));
      expect(items).not.toContainEqual(mockKey('signer-200-key'));
    });
  });

  // -------------------------------------------------------------------------
  // addNodeKeys — NodeDeleteTransaction
  // -------------------------------------------------------------------------

  describe('addNodeKeys — NodeDeleteTransaction', () => {
    const makeNodeDeleteTx = (payerAccountId: string) => {
      const tx = new NodeDeleteTransaction();
      (tx as any).transactionId = {
        accountId: { toString: () => payerAccountId },
      };
      return tx;
    };

    beforeEach(() => {
      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(makeNodeInfo('admin-key'));
    });

    it('adds admin key when fee payer is NOT a council account', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(makeNodeDeleteTx('0.0.999'));
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(1) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(mockKey('admin-key'));
    });

    it('does NOT add admin key when fee payer IS a council account', async () => {
      const councilAccountId = Object.keys(COUNCIL_ACCOUNTS)[0];
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(makeNodeDeleteTx(councilAccountId));
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(1) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).not.toContainEqual(
        mockKey('admin-key'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // addNodeKeys — non-update, non-delete transactions
  // -------------------------------------------------------------------------

  describe('addNodeKeys — generic node transaction (not update or delete)', () => {
    it('adds only the admin key', async () => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({}); // plain object — no instanceof match
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(3) }),
      );
      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(makeNodeInfo('admin-key'));
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(mockKey('admin-key'));
    });
  });

  // -------------------------------------------------------------------------
  // addNodeKeys — NodeUpdateTransaction cases (HIP-1299)
  // -------------------------------------------------------------------------

  describe('addNodeKeys — NodeUpdateTransaction', () => {
    const currentNodeAccountId = {
      toString: () => '0.0.50',
      equals: (other: any) => other?.toString?.() === '0.0.50',
    } as unknown as AccountId;

    const newAccountId = {
      toString: () => '0.0.999',
      equals: (other: any) => other?.toString?.() === '0.0.999',
    };

    function makeNodeUpdateTx(
      overrides: Partial<NodeUpdateTransaction> = {},
    ): NodeUpdateTransaction {
      const tx = new NodeUpdateTransaction();
      Object.assign(tx, overrides);
      return tx;
    }

    beforeEach(() => {
      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(
        makeNodeInfo('admin-key', currentNodeAccountId),
      );
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(2) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );
    });

    it('Case 1 — accountId NOT changing: adds only admin key, no threshold list', async () => {
      const tx = makeNodeUpdateTx({
        accountId: { ...currentNodeAccountId, equals: () => true } as any,
      });
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      expect(items).toContainEqual(mockKey('admin-key'));
      const hasThreshold = items.some(
        (k: any) => typeof k.getItems === 'function' && k.getThreshold() === 1,
      );
      expect(hasThreshold).toBe(false);
    });

    it('Case 1 — accountId is null: adds only admin key', async () => {
      const tx = makeNodeUpdateTx({ accountId: null as any });
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(mockKey('admin-key'));
    });

    it('Case 2 — accountId changing + other fields changing: adds admin key and new account key, no threshold', async () => {
      const tx = makeNodeUpdateTx({
        accountId: newAccountId as any,
        adminKey: mockKey('tx-admin-key') as any,
      });
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('new-account-key'));

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      expect(items).toContainEqual(mockKey('admin-key'));
      expect(items).toContainEqual(mockKey('new-account-key'));
      const hasThreshold = items.some(
        (k: any) => typeof k.getItems === 'function' && k.getThreshold() === 1,
      );
      expect(hasThreshold).toBe(false);
    });

    it('Case 3 — only accountId is changing: adds 1-of-2 threshold (current key OR admin key) + new account key', async () => {
      const tx = makeNodeUpdateTx({ accountId: newAccountId as any });
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('current-account-key'))
        .mockResolvedValueOnce(makeAccountInfo('new-account-key'));

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      const thresholdEntry = items.find(
        (k: any) => typeof k.getItems === 'function' && k.getThreshold() === 1,
      );

      expect(thresholdEntry).toBeDefined();
      expect(thresholdEntry!.getItems()).toContainEqual(mockKey('current-account-key'));
      expect(thresholdEntry!.getItems()).toContainEqual(mockKey('admin-key'));
      expect(items).toContainEqual(mockKey('new-account-key'));
    });

    it('Case 3 — accountId swap to 0.0.0 (removal): no new account key added', async () => {
      const zeroAccountId = {
        toString: () => '0.0.0',
        equals: (other: any) => other?.toString?.() === '0.0.0',
      };
      (AccountId.fromString as jest.Mock).mockReturnValue(zeroAccountId);

      const tx = makeNodeUpdateTx({ accountId: zeroAccountId as any });
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('current-account-key'));

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).not.toContainEqual(
        mockKey('new-account-key'),
      );
    });

    it('Case 3 — node_account_id is null: falls back to admin key only', async () => {
      const tx = makeNodeUpdateTx({ accountId: newAccountId as any });
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(makeNodeInfo('admin-key', null));

      accountCacheMock.getAccountInfoForTransaction
        .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
        .mockResolvedValueOnce(makeAccountInfo('new-account-key'));

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toContainEqual(mockKey('admin-key'));
    });
  });

  // -------------------------------------------------------------------------
  // addNodeKeys — guard clauses
  // -------------------------------------------------------------------------

  describe('addNodeKeys — guard clauses', () => {
    beforeEach(() => {
      (SDKTransaction.fromBytes as jest.Mock).mockReturnValue({});
      (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
        makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(7) }),
      );
      accountCacheMock.getAccountInfoForTransaction.mockResolvedValue(
        makeAccountInfo('fee-payer-key'),
      );
    });

    it('returns gracefully when nodeInfo is null', async () => {
      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(null);

      const result = await service.computeSignatureKey(makeTransaction());
      const items = (result as unknown as AsMockKeyList).getItems();

      expect(result).toBeDefined();
      expect(items).toHaveLength(1); // only fee payer
    });

    it('returns gracefully when admin_key is null', async () => {
      nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(makeNodeInfo(null));

      const result = await service.computeSignatureKey(makeTransaction());

      expect((result as unknown as AsMockKeyList).getItems()).toHaveLength(1); // only fee payer
    });

    it('handles exception thrown by nodeCacheService gracefully', async () => {
      nodeCacheMock.getNodeInfoForTransaction.mockRejectedValue(new Error('node cache failure'));

      const result = await service.computeSignatureKey(makeTransaction());

      expect(result).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // shouldIncludeAccountKey — via NodeUpdateTransaction cases
  // -------------------------------------------------------------------------

  describe('shouldIncludeAccountKey — via NodeUpdateTransaction cases', () => {
    const fields: Array<[string, Partial<NodeUpdateTransaction>]> = [
      ['adminKey', { adminKey: mockKey('some-key') as any }],
      ['description', { description: 'updated' as any }],
      ['certificateHash', { certificateHash: 'hash' as any }],
      ['gossipCaCertificate', { gossipCaCertificate: 'cert' as any }],
      ['serviceEndpoints', { serviceEndpoints: [{}] as any }],
      ['gossipEndpoints', { gossipEndpoints: [{}] as any }],
      ['grpcWebProxyEndpoint', { grpcWebProxyEndpoint: {} as any }],
      ['declineReward', { declineReward: true as any }],
    ];

    const newAccountId = {
      toString: () => '0.0.999',
      equals: (other: any) => other?.toString?.() === '0.0.999',
    };

    const customAccountId = {
      toString: () => '0.0.50',
      equals: (other: any) => other?.toString?.() === '0.0.50',
    } as unknown as AccountId;

    test.each(fields)(
      'when %s is set alongside accountId change → Case 2 (no threshold list)',
      async (fieldName, fieldOverride) => {
        (TransactionFactory.fromTransaction as jest.Mock).mockReturnValue(
          makeTransactionModel({ getNodeId: jest.fn().mockReturnValue(2) }),
        );
        nodeCacheMock.getNodeInfoForTransaction.mockResolvedValue(
          makeNodeInfo('admin-key', customAccountId),
        );

        const tx = new NodeUpdateTransaction();
        Object.assign(tx, { accountId: newAccountId, ...fieldOverride });
        (SDKTransaction.fromBytes as jest.Mock).mockReturnValue(tx);

        accountCacheMock.getAccountInfoForTransaction
          .mockResolvedValueOnce(makeAccountInfo('fee-payer-key'))
          .mockResolvedValueOnce(makeAccountInfo('new-account-key'));

        const result = await service.computeSignatureKey(makeTransaction());
        const items = (result as unknown as AsMockKeyList).getItems();

        const hasThreshold = items.some(
          (k: any) => typeof k.getItems === 'function' && k.getThreshold() === 1,
        );
        expect(hasThreshold).toBe(false);
        expect(items).toContainEqual(mockKey('admin-key'));
      },
    );
  });
});