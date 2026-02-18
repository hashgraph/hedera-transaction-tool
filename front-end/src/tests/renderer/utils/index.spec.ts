import { expect } from 'vitest';
import { FreezeTransaction, FreezeType, Timestamp, Transaction, TransferTransaction } from '@hashgraph/sdk';
import { hasStartTimestampChanged, transactionsDataMatch } from '@renderer/utils';

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

  test('transactionsDataMatch: Returns true for freeze transactions differing only by startTimestamp', () => {
    const futureDate1 = new Date(Date.now() + 60_000);
    const futureDate2 = new Date(Date.now() + 120_000);

    const ft1 = new FreezeTransaction()
      .setFreezeType(FreezeType.FreezeUpgrade)
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    const ft2 = new FreezeTransaction()
      .setFreezeType(FreezeType.FreezeUpgrade)
      .setStartTimestamp(Timestamp.fromDate(futureDate2));

    const match = transactionsDataMatch(ft1, ft2);
    expect(match).toBe(true);
  });

  test('transactionsDataMatch: Returns false for freeze transactions differing by freezeType', () => {
    const futureDate = new Date(Date.now() + 60_000);

    const ft1 = new FreezeTransaction()
      .setFreezeType(FreezeType.FreezeUpgrade)
      .setStartTimestamp(Timestamp.fromDate(futureDate));
    const ft2 = new FreezeTransaction()
      .setFreezeType(FreezeType.FreezeOnly)
      .setStartTimestamp(Timestamp.fromDate(futureDate));

    const match = transactionsDataMatch(ft1, ft2);
    expect(match).toBe(false);
  });
});

describe('hasStartTimestampChanged', () => {
  const now = Timestamp.fromDate(new Date());
  const futureDate1 = new Date(Date.now() + 60_000);
  const futureDate2 = new Date(Date.now() + 120_000);
  const pastDate = new Date(Date.now() - 60_000);

  test('returns false when initial is null', () => {
    const current = new FreezeTransaction();
    expect(hasStartTimestampChanged(null, current, now)).toBe(false);
  });

  test('returns false when initial is not a FreezeTransaction', () => {
    const initial = new TransferTransaction();
    const current = new FreezeTransaction();
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns false when current is not a FreezeTransaction', () => {
    const initial = new FreezeTransaction();
    const current = new TransferTransaction();
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns false when initial has no startTimestamp', () => {
    const initial = new FreezeTransaction();
    const current = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns false when current has no startTimestamp', () => {
    const initial = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction();
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns false when startTimestamps are the same', () => {
    const initial = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns true when startTimestamps differ and both are in the future', () => {
    const initial = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate2));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(true);
  });

  test('returns true when startTimestamps differ and initial is in the future', () => {
    const initial = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(pastDate));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(true);
  });

  test('returns true when startTimestamps differ and current is in the future', () => {
    const initial = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(pastDate));
    const current = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(futureDate1));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(true);
  });

  test('returns false when startTimestamps differ but both are in the past', () => {
    const pastDate1 = new Date(Date.now() - 120_000);
    const pastDate2 = new Date(Date.now() - 60_000);
    const initial = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(pastDate1));
    const current = new FreezeTransaction()
      .setStartTimestamp(Timestamp.fromDate(pastDate2));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });
});
