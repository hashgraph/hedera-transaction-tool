// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { TransactionStatus } from '@shared/interfaces';

import {
  isApprovableStatus,
  isInProgressStatus,
  isSignableStatus,
} from '@renderer/utils/transactionStatusGuards';

describe('transactionStatusGuards', () => {
  test('canceled status is not actionable', () => {
    expect(isInProgressStatus(TransactionStatus.CANCELED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.CANCELED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.CANCELED)).toBe(false);
  });

  test('signable when waiting for signatures or waiting for execution', () => {
    expect(isSignableStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
    expect(isSignableStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(true);
  });

  test('approvable in expected active states only', () => {
    expect(isApprovableStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
    expect(isApprovableStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(true);
    expect(isApprovableStatus(TransactionStatus.EXECUTED)).toBe(false);
  });

  test('NEW is in-progress but not signable or approvable', () => {
    expect(isInProgressStatus(TransactionStatus.NEW)).toBe(true);
    expect(isSignableStatus(TransactionStatus.NEW)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.NEW)).toBe(false);
  });

  test('REJECTED is not in-progress, signable, or approvable', () => {
    expect(isInProgressStatus(TransactionStatus.REJECTED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.REJECTED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.REJECTED)).toBe(false);
  });

  test('EXECUTED is not in-progress, signable, or approvable', () => {
    expect(isInProgressStatus(TransactionStatus.EXECUTED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.EXECUTED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.EXECUTED)).toBe(false);
  });

  test('FAILED is not in-progress, signable, or approvable', () => {
    expect(isInProgressStatus(TransactionStatus.FAILED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.FAILED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.FAILED)).toBe(false);
  });

  test('EXPIRED is not in-progress, signable, or approvable', () => {
    expect(isInProgressStatus(TransactionStatus.EXPIRED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.EXPIRED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.EXPIRED)).toBe(false);
  });

  test('ARCHIVED is not in-progress, signable, or approvable', () => {
    expect(isInProgressStatus(TransactionStatus.ARCHIVED)).toBe(false);
    expect(isSignableStatus(TransactionStatus.ARCHIVED)).toBe(false);
    expect(isApprovableStatus(TransactionStatus.ARCHIVED)).toBe(false);
  });

  test('WAITING_FOR_SIGNATURES is in-progress, signable, and approvable', () => {
    expect(isInProgressStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
    expect(isSignableStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
    expect(isApprovableStatus(TransactionStatus.WAITING_FOR_SIGNATURES)).toBe(true);
  });

  test('WAITING_FOR_EXECUTION is in-progress, signable, and approvable', () => {
    expect(isInProgressStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(true);
    expect(isSignableStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(true);
    expect(isApprovableStatus(TransactionStatus.WAITING_FOR_EXECUTION)).toBe(true);
  });

  test('null returns false for all guards', () => {
    expect(isInProgressStatus(null)).toBe(false);
    expect(isSignableStatus(null)).toBe(false);
    expect(isApprovableStatus(null)).toBe(false);
  });

  test('undefined returns false for all guards', () => {
    expect(isInProgressStatus(undefined)).toBe(false);
    expect(isSignableStatus(undefined)).toBe(false);
    expect(isApprovableStatus(undefined)).toBe(false);
  });
});
