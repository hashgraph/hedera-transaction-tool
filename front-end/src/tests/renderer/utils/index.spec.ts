import { expect } from 'vitest';
import { Transaction } from '@hashgraph/sdk';
import { transactionsDataMatch } from '@renderer/utils';

describe('General utilities', () => {
  const t1Bytes = [
    10, 123, 26, 0, 34, 119, 10, 25, 10, 12, 8, 134, 232, 231, 197, 6, 16, 192, 138, 200, 204, 1,
    18, 7, 8, 0, 16, 0, 24, 234, 7, 24, 0, 24, 128, 132, 175, 95, 34, 3, 8, 180, 1, 50, 0, 90, 78,
    10, 34, 18, 32, 236, 165, 129, 94, 199, 152, 54, 76, 76, 197, 25, 27, 157, 137, 8, 85, 148, 213,
    219, 193, 149, 230, 224, 44, 152, 86, 171, 200, 39, 134, 30, 20, 16, 128, 200, 175, 160, 37, 48,
    255, 255, 255, 255, 255, 255, 255, 255, 127, 56, 255, 255, 255, 255, 255, 255, 255, 255, 127,
    64, 0, 74, 5, 8, 128, 206, 218, 3, 106, 0, 112, 0, 136, 1, 0,
  ];
  const t2Bytes = [
    10, 122, 26, 0, 34, 118, 10, 24, 10, 11, 8, 159, 232, 231, 197, 6, 16, 128, 176, 227, 45, 18, 7,
    8, 0, 16, 0, 24, 234, 7, 24, 0, 24, 128, 132, 175, 95, 34, 3, 8, 180, 1, 50, 0, 90, 78, 10, 34,
    18, 32, 236, 165, 129, 94, 199, 152, 54, 76, 76, 197, 25, 27, 157, 137, 8, 85, 148, 213, 219,
    193, 149, 230, 224, 44, 152, 86, 171, 200, 39, 134, 30, 20, 16, 128, 200, 175, 160, 37, 48, 255,
    255, 255, 255, 255, 255, 255, 255, 127, 56, 255, 255, 255, 255, 255, 255, 255, 255, 127, 64, 0,
    74, 5, 8, 128, 206, 218, 3, 106, 0, 112, 0, 136, 1, 0,
  ];
  const t3Bytes = [
    10, 143, 1, 26, 0, 34, 138, 1, 10, 21, 10, 8, 8, 159, 221, 140, 198, 6, 16, 0, 18, 7, 8, 0, 16,
    0, 24, 234, 7, 24, 0, 24, 128, 132, 175, 95, 34, 3, 8, 180, 1, 50, 23, 83, 97, 109, 112, 108,
    101, 32, 116, 114, 97, 110, 115, 97, 99, 116, 105, 111, 110, 32, 109, 101, 109, 111, 90, 78, 10,
    34, 18, 32, 236, 165, 129, 94, 199, 152, 54, 76, 76, 197, 25, 27, 157, 137, 8, 85, 148, 213,
    219, 193, 149, 230, 224, 44, 152, 86, 171, 200, 39, 134, 30, 20, 16, 128, 200, 175, 160, 37, 48,
    255, 255, 255, 255, 255, 255, 255, 255, 127, 56, 255, 255, 255, 255, 255, 255, 255, 255, 127,
    64, 0, 74, 5, 8, 128, 206, 218, 3, 106, 0, 112, 0, 136, 1, 0,
  ];

  test('transactionsDataMatch: Returns true when matching identical transactions', () => {
    const t1 = Transaction.fromBytes(new Uint8Array(t1Bytes));

    const match = transactionsDataMatch(t1, t1);
    expect(match).toBe(true);
  });

  test('transactionsDataMatch: Returns true when matching transactions differing only by validStart', () => {
    const t1 = Transaction.fromBytes(new Uint8Array(t1Bytes));
    const t2 = Transaction.fromBytes(new Uint8Array(t2Bytes));

    const match = transactionsDataMatch(t1, t2);
    expect(match).toBe(true);
  });
  test('transactionsDataMatch: Returns false when matching transactions differing by memo', () => {
    const t2 = Transaction.fromBytes(new Uint8Array(t2Bytes));
    const t3 = Transaction.fromBytes(new Uint8Array(t3Bytes));

    const match = transactionsDataMatch(t2, t3);
    expect(match).toBe(false);
  });
});
