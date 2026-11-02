// Matches libuv's default threadpool size, which is what async crypto.pbkdf2 runs on.
export const CRYPTO_CONCURRENCY = 4;

/* Maps items with at most `limit` tasks in flight. Preserves order and stops starting new
 * tasks after the first failure. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;

  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
