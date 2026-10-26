import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  FreezeTransaction,
  LedgerId,
  Timestamp,
  Transaction,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import {
  accountIdMatchesInput,
  collectMissingKeys,
  collectRequiredKeys,
  decorateAccountId,
  type FreezeData,
  hasStartTimestampChanged,
  matchAccountId,
  sanitizeAccountId,
  signItems,
  transactionsDataMatch,
} from '@renderer/utils';
import type { SignatureItem } from '@renderer/types';

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

const mockDismissNotifications = vi.fn();
const mockUseNotificationsStore = vi.fn();
vi.mock('@renderer/stores/storeNotifications', () => ({
  __esModule: true,
  default: () => mockUseNotificationsStore(),
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
  test('transactionsDataMatch: Returns true when matching identical data', () => {
    const d1: Record<string, unknown> = {
      attr1: 'value1',
      attr2: 'value2',
      validStart: Date.now(),
      startTimestamp: Date.now(),
      expirationTime: Date.now(),
    };

    const match = transactionsDataMatch(d1, d1);
    expect(match).toBe(true);
  });

  test('transactionsDataMatch: Returns true when matching transactions differing only by validStart', () => {
    const d: Record<string, unknown> = {
      attr1: 'value1',
      attr2: 'value2',
      startTimestamp: Date.now(),
      expirationTime: Date.now(),
    };
    const d1 = {
      ...d,
      validStart: Date.parse('1970-01-01T00:00:00Z'),
    };
    const d2 = {
      ...d,
      validStart: Date.parse('1970-01-01T01:00:00Z'),
    };

    const match = transactionsDataMatch(d1, d2);
    expect(match).toBe(true);
  });

  test('transactionsDataMatch: Returns false when matching transactions differing by memo', () => {
    const d: Record<string, unknown> = {
      validStart: Date.now(),
      startTimestamp: Date.now(),
      expirationTime: Date.now(),
    };
    const d1 = {
      ...d,
      transactionMemo: 'memo1',
    };
    const d2 = {
      ...d,
      transactionMemo: 'memo2',
    };

    const match = transactionsDataMatch(d1, d2);
    expect(match).toBe(false);
  });

  test('transactionsDataMatch: Returns true for freeze transactions differing only by startTimestamp', () => {
    const futureDate1 = new Date(Date.now() + 60_000);
    const futureDate2 = new Date(Date.now() + 120_000);

    const d: FreezeData = {
      freezeType: 1,
      startTimestamp: new Date(),
      fileId: '0.0.42',
      fileHash: 'ab'.repeat(48),
    };

    const d1: FreezeData = {
      ...d,
      startTimestamp: futureDate1,
    };

    const d2: FreezeData = {
      ...d,
      startTimestamp: futureDate2,
    };

    const match = transactionsDataMatch(d1, d2);
    expect(match).toBe(true);
  });

  test('transactionsDataMatch: Returns false for freeze transactions differing by freezeType', () => {
    const futureDate = new Date(Date.now() + 60_000);

    const d: FreezeData = {
      freezeType: 1,
      startTimestamp: futureDate,
      fileId: '0.0.42',
      fileHash: 'ab'.repeat(48),
    };

    const d1: FreezeData = {
      ...d,
      freezeType: 1,
    };

    const d2: FreezeData = {
      ...d,
      freezeType: 2,
    };

    const match = transactionsDataMatch(d1, d2);
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

describe('collectRequiredKeys', () => {
  let originalFromBytes: any;

  beforeEach(() => {
    vi.clearAllMocks();

    originalFromBytes = Transaction.fromBytes;
    Transaction.fromBytes = vi.fn(() => ({ mocked: 'tx' }) as any) as any;

    mockUseNetworkStore.mockReturnValue({
      mirrorNodeBaseURL: 'https://mirror.test',
    });

    mockUseUserStore.mockReturnValue({
      personal: { id: 'user-1', isLoggedIn: true },
      keyPairs: [{ public_key: 'pk-1' }],
      selectedOrganization: {
        serverUrl: 'https://api.test',
        userKeys: ['org-key-1'],
        isLoading: false,
        isServerActive: true,
        loginRequired: false,
      },
    });
  });

  afterEach(() => {
    Transaction.fromBytes = originalFromBytes;
  });

  test('t1', async () => {
    mockUsersPublicRequiredToSign.mockResolvedValue(['pk-1']);

    const result = await collectRequiredKeys(
      [{ id: 0, transactionBytes: '00' } as any, { id: 1, transactionBytes: '00' } as any],
      {} as any,
    );
    expect(result).toEqual([
      { transactionId: 0, transaction: { mocked: 'tx' }, publicKeys: ['pk-1'] },
      { transactionId: 1, transaction: { mocked: 'tx' }, publicKeys: ['pk-1'] },
    ]);

    Transaction.fromBytes = originalFromBytes;
  });
});

describe('collectMissingKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUserStore.mockReturnValue({
      personal: { id: 'user-1', isLoggedIn: true },
      keyPairs: [{ public_key: 'pk-1' }],
      selectedOrganization: {
        serverUrl: 'https://api.test',
        userKeys: ['org-key-1'],
        isLoading: false,
        isServerActive: true,
        loginRequired: false,
      },
    });
  });

  test('collectMissingKeys() returns no missing key for empty input', () => {
    const signatureItems: SignatureItem[] = [];
    const missingKeys = collectMissingKeys(signatureItems);
    expect(missingKeys).toEqual([]);
  });

  test('collectMissingKeys() returns no missing key', () => {
    const signatureItems: SignatureItem[] = [
      { publicKeys: ['pk-1'], transaction: {} as any, transactionId: 0 },
    ];
    const missingKeys = collectMissingKeys(signatureItems);
    expect(missingKeys).toEqual([]);
  });

  test('collectMissingKeys() returns one missing key', () => {
    const signatureItems: SignatureItem[] = [
      { publicKeys: ['pk-1', 'pk-2'], transaction: {} as any, transactionId: 0 },
    ];
    const missingKeys = collectMissingKeys(signatureItems);
    expect(missingKeys).toEqual(['pk-2']);
  });
});

describe('signItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUserStore.mockReturnValue({
      personal: { id: 'user-1', isLoggedIn: true },
      keyPairs: [{ public_key: 'pk-1' }],
      selectedOrganization: {
        serverUrl: 'https://api.test',
        userKeys: ['org-key-1'],
        isLoading: false,
        isServerActive: true,
        loginRequired: false,
      },
    });
  });

  test('returns empty when no signatures are required (does not upload)', async () => {
    mockUsersPublicRequiredToSign.mockResolvedValue(['pk-1']);

    const result = await signItems([], 'pw');
    expect(result).toEqual([]);
    expect(mockUploadSignatures).not.toHaveBeenCalled();
    expect(mockDismissNotifications).not.toHaveBeenCalled();
  });

  test('uploads signatures for which user has key and reject others', async () => {
    mockUsersPublicRequiredToSign.mockResolvedValue(['pk-1']);
    mockUploadSignatures.mockResolvedValue({
      data: {
        signers: [{ publicKeys: ['pk-1'], transaction: {}, transactionId: 0 } as any],
        notificationReceiverIds: [10, 11, 12],
      },
    });
    mockUseNotificationsStore.mockReturnValue({
      dismissNotifications: mockDismissNotifications,
    });

    const inputItems: SignatureItem[] = [
      { publicKeys: ['pk-1'], transaction: {}, transactionId: 0 } as any,
      { publicKeys: ['pk-2'], transaction: {}, transactionId: 1 } as any,
    ];
    const rejectedItems = await signItems(inputItems, 'pw');

    expect(rejectedItems).toStrictEqual([inputItems[1]]);
    expect(mockUploadSignatures).toHaveBeenCalledTimes(1);
    expect(mockDismissNotifications).toHaveBeenCalledWith('https://api.test', [10, 11, 12]);
  });
});

describe('sanitizeAccountId', () => {
  test('passes through a well-formed account id with no checksum', () => {
    expect(sanitizeAccountId('0.0.100')).toBe('0.0.100');
  });

  test('strips invalid characters outright', () => {
    expect(sanitizeAccountId('0.0.abc')).toBe('0.0.');
  });

  test('limits to three dot-separated parts', () => {
    expect(sanitizeAccountId('0.0.1.2.3')).toBe('0.0.1');
  });

  test('removes leading zeros from each part', () => {
    expect(sanitizeAccountId('00.00.0100')).toBe('0.0.100');
  });

  test('allows a checksum suffix once the 0.0.0 shape is present', () => {
    expect(sanitizeAccountId('0.0.100-abcde')).toBe('0.0.100-abcde');
  });

  test('limits the checksum suffix to 5 lowercase letters', () => {
    expect(sanitizeAccountId('0.0.100-abcdefgh')).toBe('0.0.100-abcde');
  });
});

describe('matchAccountId', () => {
  test('tier 1: exact whole-string prefix match wins, alignStart 0', () => {
    expect(matchAccountId(['0.0.100', '0.0.258'], '0.0.1')).toEqual({ index: 0, alignStart: 0 });
  });

  test('tier 2: falls back to a per-segment match when no whole-string prefix matches', () => {
    // "2" isn't a prefix of the whole string "1.2.300", but matches the realm segment.
    expect(matchAccountId(['1.2.300'], '2')).toEqual({ index: 0, alignStart: 2 });
  });

  test('aligns at the real segment start, not the first coincidental occurrence', () => {
    // Naive indexOf would find "22" at index 1 (inside the leading "122"); the real
    // match is the trailing "22" segment at index 6.
    expect(matchAccountId(['122.2.22'], '22')).toEqual({ index: 0, alignStart: 6 });
  });

  test('returns null when nothing matches', () => {
    expect(matchAccountId(['0.0.100'], '0.0.9')).toBeNull();
  });
});

describe('accountIdMatchesInput', () => {
  test('true for a whole-string prefix match', () => {
    expect(accountIdMatchesInput('0.0.100', '0.0.1')).toBe(true);
  });

  test('true for a per-segment match', () => {
    expect(accountIdMatchesInput('1.2.300', '2')).toBe(true);
  });

  test('false when nothing matches', () => {
    expect(accountIdMatchesInput('0.0.100', '0.0.9')).toBe(false);
  });
});

describe('decorateAccountId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A fake client shaped just enough to satisfy the real SDK's checksum computation
    // (AccountId.toStringWithChecksum reads client._network._ledgerId._ledgerId) —
    // checksums are computed locally from the ledger ID, no network I/O involved.
    mockUseNetworkStore.mockReturnValue({
      client: { _network: { _ledgerId: LedgerId.TESTNET } },
    });
  });

  test('returns the checksum suffix for a valid account id', () => {
    expect(decorateAccountId('0.0.100')).toBe('-quros');
  });

  test('returns empty string for an empty value', () => {
    expect(decorateAccountId('')).toBe('');
  });

  test('returns empty string for an unparsable value', () => {
    // getAccountIdWithChecksum's try/catch returns the input unchanged on parse
    // failure, so decorateAccountId sees no length difference and returns ''.
    expect(decorateAccountId('0.0.')).toBe('');
  });
});
