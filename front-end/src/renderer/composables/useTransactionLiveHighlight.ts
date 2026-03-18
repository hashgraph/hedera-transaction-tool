import { ref, onBeforeUnmount } from 'vue';

export function useTransactionLiveHighlight(duration = 3000) {
  const recentlyUpdatedTxIds = ref<Set<number>>(new Set());
  const recentlyUpdatedGroupIds = ref<Set<number>>(new Set());
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

  function clearHighlights() {
    recentlyUpdatedTxIds.value = new Set();
    recentlyUpdatedGroupIds.value = new Set();
  }

  function highlightAndFetch(
    txIds: number[],
    groupIds: number[],
    fetchFn: () => Promise<void>,
  ) {
    for (const id of txIds) recentlyUpdatedTxIds.value.add(id);
    for (const id of groupIds) recentlyUpdatedGroupIds.value.add(id);

    // Trigger reactivity
    recentlyUpdatedTxIds.value = new Set(recentlyUpdatedTxIds.value);
    recentlyUpdatedGroupIds.value = new Set(recentlyUpdatedGroupIds.value);

    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(clearHighlights, duration);

    return fetchFn();
  }

  onBeforeUnmount(() => {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  });

  return {
    recentlyUpdatedTxIds,
    recentlyUpdatedGroupIds,
    highlightAndFetch,
  };
}
