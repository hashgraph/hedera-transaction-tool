import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FreezeTransaction, FreezeType, Timestamp, Transaction, TransferTransaction } from '@hashgraph/sdk';
import { hasStartTimestampChanged, transactionsDataMatch, signTransactions } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager';

export const toastErrorSpy = vi.fn();
const toastMock = { error: toastErrorSpy };

vi.mock('vue-toast-notification', () => ({
  useToast: () => toastMock,
}));

const mockUseUserStore = vi.fn();
vi.mock('@renderer/stores/storeUser', () => ({
  __esModule: true,
  default: () => mockUseUserStore(),
}));

const mockUseNetworkStore = vi.fn();
vi.mock('@renderer/stores/storeNetwork', () => ({
  __esModule: true,
  default: () => mockUseNetworkStore(),
}));

const mockUsersPublicRequiredToSign = vi.fn();
vi.mock('@renderer/utils/transactionSignatureModels', () => ({
  usersPublicRequiredToSign: (...args: any[]) => mockUsersPublicRequiredToSign(...args),
}));

const mockUploadSignatures = vi.fn();
vi.mock('@renderer/services/organization', () => ({
  uploadSignatures: (...args: any[]) => mockUploadSignatures(...args),
}));

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
    const current = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns false when current has no startTimestamp', () => {
    const initial = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction();
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns false when startTimestamps are the same', () => {
    const initial = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });

  test('returns true when startTimestamps differ and both are in the future', () => {
    const initial = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate2));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(true);
  });

  test('returns true when startTimestamps differ and initial is in the future', () => {
    const initial = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    const current = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(pastDate));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(true);
  });

  test('returns true when startTimestamps differ and current is in the future', () => {
    const initial = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(pastDate));
    const current = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(futureDate1));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(true);
  });

  test('returns false when startTimestamps differ but both are in the past', () => {
    const pastDate1 = new Date(Date.now() - 120_000);
    const pastDate2 = new Date(Date.now() - 60_000);
    const initial = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(pastDate1));
    const current = new FreezeTransaction().setStartTimestamp(Timestamp.fromDate(pastDate2));
    expect(hasStartTimestampChanged(initial, current, now)).toBe(false);
  });
});

describe('signTransactions', () => {
  let originalFromBytes: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseNetworkStore.mockReturnValue({
      mirrorNodeBaseURL: 'https://mirror.test',
    });

    mockUseUserStore.mockReturnValue({
      personal: { id: 'user-1', isLoggedIn: true, },
      keyPairs: [{ public_key: 'pk-1' }],
      selectedOrganization: {
        serverUrl: 'https://api.test',
        userKeys: ['org-key-1'],
        isLoading: false,
        isServerActive: true,
        loginRequired: false,
      },
    });

    originalFromBytes = Transaction.fromBytes;
    Transaction.fromBytes = vi.fn(() => ({ mocked: 'tx' } as any)) as any;
  });

  afterEach(() => {
    Transaction.fromBytes = originalFromBytes;
  });

  test('returns false and shows toast when user is missing required public keys', async () => {
    mockUsersPublicRequiredToSign.mockResolvedValue(['pk-missing']);

    const result = await signTransactions(
      [{ id: 'tx-1', transactionBytes: '00' } as any],
      null,
      {} as any,
      {} as any,
      {} as any,
      new ToastManager(),
    );

    expect(result).toBe(false);
    expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    expect(mockUploadSignatures).not.toHaveBeenCalled();
  });

  test('returns false when no signatures are required (does not upload)', async () => {
    mockUsersPublicRequiredToSign.mockResolvedValue([]);

    const result = await signTransactions(
      [{ id: 'tx-1', transactionBytes: '00' } as any],
      'pw',
      {} as any,
      {} as any,
      {} as any,
      new ToastManager(),
    );

    expect(result).toBe(false);
    expect(mockUploadSignatures).not.toHaveBeenCalled();
  });

  test('uploads signatures and returns true when signatures are required and user has keys', async () => {
    mockUsersPublicRequiredToSign.mockResolvedValue(['pk-1']);

    const result = await signTransactions(
      [
        { id: 'tx-1', transactionBytes: '00' } as any,
        { id: 'tx-2', transactionBytes: '00' } as any,
      ],
      'pw',
      {} as any,
      {} as any,
      {} as any,
      new ToastManager(),
    );

    expect(result).toBe(true);
    expect(mockUploadSignatures).toHaveBeenCalledTimes(1);

    const args = mockUploadSignatures.mock.calls[0];

    expect(args[0]).toBe('user-1'); // userId
    expect(args[1]).toBe('pw'); // password
    expect(args[2]).toEqual(expect.objectContaining({ serverUrl: 'https://api.test' }));

    const signatureItems = args[6] as any[];
    expect(Array.isArray(signatureItems)).toBe(true);
    expect(signatureItems).toHaveLength(2);
    expect(signatureItems[0]).toEqual(
      expect.objectContaining({
        transactionId: 'tx-1',
        publicKeys: ['pk-1'],
      }),
    );
    expect(signatureItems[1]).toEqual(
      expect.objectContaining({
        transactionId: 'tx-2',
        publicKeys: ['pk-1'],
      }),
    );
  });
});
