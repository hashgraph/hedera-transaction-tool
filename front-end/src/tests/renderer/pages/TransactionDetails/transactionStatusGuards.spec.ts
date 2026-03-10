// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { TransactionStatus } from '@shared/interfaces';

import {
  isApprovableStatus,
  isInProgressStatus,
  isSignableStatus,
} from '@renderer/pages/TransactionDetails/components/transactionStatusGuards';

describe('transactionStatusGuards', () => {
  test('canceled status is not actionable', () => {
    expect(isInProgressStatus(TransactionStatus.CANCELED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.CANCELED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.CANCELED)).toBe(false);
  });

  test('signable only when waiting for signatures', () => {
    expect(isSignableStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
    expect(isSignableStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(false);
  });

  test('approvable in expected active states only', () => {
    expect(isApprovableStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
    expect(isApprovableStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(true);
    expect(isApprovableStatus(TransactionStatus.EXECUTED)).toBe(false);
  });
});
