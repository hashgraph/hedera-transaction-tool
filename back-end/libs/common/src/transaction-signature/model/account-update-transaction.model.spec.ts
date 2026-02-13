import { AccountId, AccountUpdateTransaction, PrivateKey } from '@hashgraph/sdk';
import { AccountUpdateTransactionModel } from './account-update-transaction.model';

describe('AccountUpdateTransactionModel', () => {
  let registerMock: jest.Mock;
  let mockTransaction: AccountUpdateTransaction;
  let testKey: any;

  beforeEach(() => {
    jest.resetModules();

    registerMock = jest.fn();
    jest.doMock('./transaction-factory', () => ({
      __esModule: true,
      default: { register: registerMock },
      register: registerMock,
    }));

    mockTransaction = new AccountUpdateTransaction();
    testKey = PrivateKey.generateED25519().publicKey;
  });

  describe('TRANSACTION_TYPE', () => {
    it('should have the correct transaction type', () => {
      expect(AccountUpdateTransactionModel.TRANSACTION_TYPE).toBe('AccountUpdateTransaction');
    });
  });

  describe('getNewKeys', () => {
    it('should return the new key when key is set and not a system account', () => {
      const accountId = AccountId.fromString('0.0.5000');
      mockTransaction.setAccountId(accountId);
      mockTransaction.setKey(testKey);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(testKey);
    });

    it('should return empty array when key is not set', () => {
      const accountId = AccountId.fromString('0.0.5000');
      mockTransaction.setAccountId(accountId);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toEqual([]);
    });

    it('should return empty array when updating system account with treasury fee payer', () => {
      const systemAccount = AccountId.fromString('0.0.100');
      const treasuryAccount = AccountId.fromString('0.0.2');

      mockTransaction.setAccountId(systemAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: treasuryAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toEqual([]);
    });

    it('should return empty array when updating system account with admin fee payer', () => {
      const systemAccount = AccountId.fromString('0.0.100');
      const adminAccount = AccountId.fromString('0.0.50');

      mockTransaction.setAccountId(systemAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: adminAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toEqual([]);
    });

    it('should return the key when updating system account with non-privileged fee payer', () => {
      const systemAccount = AccountId.fromString('0.0.100');
      const normalAccount = AccountId.fromString('0.0.5000');

      mockTransaction.setAccountId(systemAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: normalAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(testKey);
    });
  });

  describe('getSigningAccounts', () => {
    it('should return set with account ID for non-system account', () => {
      const accountId = AccountId.fromString('0.0.5000');
      mockTransaction.setAccountId(accountId);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.5000')).toBe(true);
    });

    it('should return empty set when accountId is not set', () => {
      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(0);
    });

    it('should return empty set for system account with treasury fee payer', () => {
      const systemAccount = AccountId.fromString('0.0.100');
      const treasuryAccount = AccountId.fromString('0.0.2');

      mockTransaction.setAccountId(systemAccount);
      mockTransaction.setTransactionId({
        accountId: treasuryAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(0);
    });

    it('should return empty set for system account with admin fee payer', () => {
      const systemAccount = AccountId.fromString('0.0.500');
      const adminAccount = AccountId.fromString('0.0.50');

      mockTransaction.setAccountId(systemAccount);
      mockTransaction.setTransactionId({
        accountId: adminAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(0);
    });

    it('should return set with account ID for system account with non-privileged fee payer', () => {
      const systemAccount = AccountId.fromString('0.0.100');
      const normalAccount = AccountId.fromString('0.0.5000');

      mockTransaction.setAccountId(systemAccount);
      mockTransaction.setTransactionId({
        accountId: normalAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.100')).toBe(true);
    });

    it('should return set with account ID when fee payer is null', () => {
      const accountId = AccountId.fromString('0.0.100');
      mockTransaction.setAccountId(accountId);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.100')).toBe(true);
    });
  });

  describe('system account boundaries', () => {
    it('should treat account 0.0.3 as a system account', () => {
      const minSystemAccount = AccountId.fromString('0.0.3');
      const treasuryAccount = AccountId.fromString('0.0.2');

      mockTransaction.setAccountId(minSystemAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: treasuryAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toEqual([]);
    });

    it('should treat account 0.0.1000 as a system account', () => {
      const maxSystemAccount = AccountId.fromString('0.0.1000');
      const treasuryAccount = AccountId.fromString('0.0.2');

      mockTransaction.setAccountId(maxSystemAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: treasuryAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toEqual([]);
    });

    it('should not treat account 0.0.2 as requiring waiver', () => {
      const belowMinAccount = AccountId.fromString('0.0.2');
      const treasuryAccount = AccountId.fromString('0.0.2');

      mockTransaction.setAccountId(belowMinAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: treasuryAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toHaveLength(1);
    });

    it('should not treat account 0.0.1001 as a system account', () => {
      const aboveMaxAccount = AccountId.fromString('0.0.1001');
      const treasuryAccount = AccountId.fromString('0.0.2');

      mockTransaction.setAccountId(aboveMaxAccount);
      mockTransaction.setKey(testKey);
      mockTransaction.setTransactionId({
        accountId: treasuryAccount,
        validStart: null,
      } as any);

      const model = new AccountUpdateTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toHaveLength(1);
    });
  });
});