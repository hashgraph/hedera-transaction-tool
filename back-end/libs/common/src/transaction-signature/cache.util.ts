/**
 * Check if cached data is fresh based on threshold.
 */
export function isFresh(updatedAt: Date | null | undefined, thresholdMs: number): boolean {
  return (
    !!updatedAt && Date.now() - updatedAt.getTime() < thresholdMs
  );
}