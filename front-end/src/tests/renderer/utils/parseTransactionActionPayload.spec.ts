import { parseTransactionActionPayload } from '@renderer/utils/parseTransactionActionPayload';

describe('parseTransactionActionPayload', () => {
  it('returns null for null/undefined input', () => {
    expect(parseTransactionActionPayload(null)).toBeNull();
    expect(parseTransactionActionPayload(undefined)).toBeNull();
  });

  it('returns null for non-array input', () => {
    expect(parseTransactionActionPayload('hello')).toBeNull();
    expect(parseTransactionActionPayload(42)).toBeNull();
    expect(parseTransactionActionPayload({})).toBeNull();
  });

  it('returns null for legacy empty string payload', () => {
    expect(parseTransactionActionPayload([''])).toBeNull();
  });

  it('returns null for array of strings (legacy format)', () => {
    expect(parseTransactionActionPayload(['', ''])).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(parseTransactionActionPayload([])).toBeNull();
  });

  it('returns null when objects contain no IDs', () => {
    expect(parseTransactionActionPayload([{ eventType: 'update' }])).toBeNull();
    expect(parseTransactionActionPayload([{ transactionIds: [], groupIds: [] }])).toBeNull();
  });

  it('parses single event with transactionIds and groupIds', () => {
    const result = parseTransactionActionPayload([
      { transactionIds: [1, 2], groupIds: [10], eventType: 'status_update' },
    ]);

    expect(result).toEqual({
      transactionIds: [1, 2],
      groupIds: [10],
      eventType: 'status_update',
    });
  });

  it('parses single event with only transactionIds', () => {
    const result = parseTransactionActionPayload([
      { transactionIds: [5], eventType: 'update' },
    ]);

    expect(result).toEqual({
      transactionIds: [5],
      groupIds: [],
      eventType: 'update',
    });
  });

  it('parses single event with only groupIds', () => {
    const result = parseTransactionActionPayload([
      { groupIds: [20], eventType: 'status_update' },
    ]);

    expect(result).toEqual({
      transactionIds: [],
      groupIds: [20],
      eventType: 'status_update',
    });
  });

  it('unions IDs across batched items', () => {
    const result = parseTransactionActionPayload([
      { transactionIds: [1, 2], groupIds: [10], eventType: 'status_update' },
      { transactionIds: [2, 3], groupIds: [20], eventType: 'status_update' },
    ]);

    expect(result).not.toBeNull();
    expect(result!.transactionIds.sort()).toEqual([1, 2, 3]);
    expect(result!.groupIds.sort()).toEqual([10, 20]);
    expect(result!.eventType).toBe('status_update');
  });

  it('deduplicates IDs', () => {
    const result = parseTransactionActionPayload([
      { transactionIds: [1, 1, 2], groupIds: [10, 10], eventType: 'update' },
    ]);

    expect(result).not.toBeNull();
    expect(result!.transactionIds.sort()).toEqual([1, 2]);
    expect(result!.groupIds).toEqual([10]);
  });

  it('uses last non-null eventType from batch', () => {
    const result = parseTransactionActionPayload([
      { transactionIds: [1], eventType: 'update' },
      { transactionIds: [2], eventType: 'status_update' },
    ]);

    expect(result!.eventType).toBe('status_update');
  });

  it('handles items with missing optional fields', () => {
    const result = parseTransactionActionPayload([
      { transactionIds: [1] },
    ]);

    expect(result).toEqual({
      transactionIds: [1],
      groupIds: [],
      eventType: null,
    });
  });
});
