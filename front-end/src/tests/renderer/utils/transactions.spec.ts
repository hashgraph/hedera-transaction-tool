/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect } from 'vitest';
import { TransferTransaction, Hbar } from '@hashgraph/sdk';
import {
  hasTransfersOutOfStaking,
} from '@renderer/utils/transactions';

describe('hasTransfersOutOfStaking', () => {
  const STAKING_ACCOUNT_1 = '0.0.400';
  const STAKING_ACCOUNT_2 = '0.0.439';
  const NON_STAKING_ACCOUNT_1 = '0.0.1000';
  const NON_STAKING_ACCOUNT_2 = '0.0.1001';

  test('should return false for non-TransferTransaction', () => {
    // Using a mocked object that is not an instance of TransferTransaction
    expect(hasTransfersOutOfStaking({} as any)).toBe(false);
  });

  test('should return false when there are no transfers', () => {
    const tx = new TransferTransaction();
    expect(hasTransfersOutOfStaking(tx)).toBe(false);
  });

  test('should return false for transfers entirely outside staking range', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(NON_STAKING_ACCOUNT_1, Hbar.fromTinybars(-100))
      .addHbarTransfer(NON_STAKING_ACCOUNT_2, Hbar.fromTinybars(100));
    expect(hasTransfersOutOfStaking(tx)).toBe(false);
  });

  test('should return false for transfers entirely within staking range (net zero change to staking range)', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(STAKING_ACCOUNT_1, Hbar.fromTinybars(-100))
      .addHbarTransfer(STAKING_ACCOUNT_2, Hbar.fromTinybars(100));
    expect(hasTransfersOutOfStaking(tx)).toBe(false);
  });

  test('should return true for transfer from staking to non-staking', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(STAKING_ACCOUNT_1, Hbar.fromTinybars(-100))
      .addHbarTransfer(NON_STAKING_ACCOUNT_1, Hbar.fromTinybars(100));
    expect(hasTransfersOutOfStaking(tx)).toBe(true);
  });

  test('should return false for transfer from non-staking to staking', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(NON_STAKING_ACCOUNT_1, Hbar.fromTinybars(-100))
      .addHbarTransfer(STAKING_ACCOUNT_1, Hbar.fromTinybars(100));
    expect(hasTransfersOutOfStaking(tx)).toBe(false);
  });

  test('should return true when net staking balance decreases (multi-account)', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(STAKING_ACCOUNT_1, Hbar.fromTinybars(-100))
      .addHbarTransfer(STAKING_ACCOUNT_2, Hbar.fromTinybars(50))
      .addHbarTransfer(NON_STAKING_ACCOUNT_1, Hbar.fromTinybars(50));
    expect(hasTransfersOutOfStaking(tx)).toBe(true);
  });

  test('should return false when net staking balance increases (multi-account)', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(STAKING_ACCOUNT_1, Hbar.fromTinybars(100))
      .addHbarTransfer(STAKING_ACCOUNT_2, Hbar.fromTinybars(-50))
      .addHbarTransfer(NON_STAKING_ACCOUNT_1, Hbar.fromTinybars(-50));
    expect(hasTransfersOutOfStaking(tx)).toBe(false);
  });

  test('should return true for large debit from staking and small credit to staking', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer(STAKING_ACCOUNT_1, Hbar.fromTinybars(-1000))
      .addHbarTransfer(STAKING_ACCOUNT_2, Hbar.fromTinybars(1))
      .addHbarTransfer(NON_STAKING_ACCOUNT_1, Hbar.fromTinybars(999));
    expect(hasTransfersOutOfStaking(tx)).toBe(true);
  });

  test('should return false for transfers involving boundary accounts outside range (399, 440)', () => {
    const tx = new TransferTransaction()
      .addHbarTransfer('0.0.399', Hbar.fromTinybars(-100))
      .addHbarTransfer('0.0.440', Hbar.fromTinybars(100));
    expect(hasTransfersOutOfStaking(tx)).toBe(false);
  });
});
