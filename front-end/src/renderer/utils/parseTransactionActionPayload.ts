export interface TransactionActionPayload {
  transactionIds: number[];
  groupIds: number[];
  eventType: string | null;
}

/**
 * Parses a batched TRANSACTION_ACTION WebSocket payload into a unified structure.
 *
 * The batcher merges multiple events into an array of objects, each containing
 * transactionIds, groupIds, and eventType. This function unions all IDs across
 * items in the batch.
 *
 * Returns null for legacy payloads (empty string arrays) or unparseable data,
 * which signals the caller to fall back to a full refetch.
 */
export function parseTransactionActionPayload(raw: unknown): TransactionActionPayload | null {
  if (!raw || !Array.isArray(raw)) return null;

  const txIds = new Set<number>();
  const grpIds = new Set<number>();
  let eventType: string | null = null;

  for (const item of raw) {
    // Legacy payload: array of empty strings like ['']
    if (typeof item === 'string') return null;

    if (item && typeof item === 'object') {
      for (const id of item.transactionIds ?? []) txIds.add(id);
      for (const id of item.groupIds ?? []) grpIds.add(id);
      if (item.eventType) eventType = item.eventType;
    }
  }

  if (txIds.size === 0 && grpIds.size === 0) return null;

  return { transactionIds: [...txIds], groupIds: [...grpIds], eventType };
}
