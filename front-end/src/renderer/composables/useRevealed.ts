import { onBeforeUnmount, onMounted, type Ref, watch, type WatchHandle } from 'vue';

export default function useRevealed(
  element: Ref<HTMLElement | null>,
  onShow: () => void,
) {
  /* State */
  let revealed = false;
  let observer: IntersectionObserver | null = null;
  let watchHandle: WatchHandle | null = null;

  /* Hooks */
  onMounted(() => {
    watchHandle = watch(element, updateObserver, { immediate: true });
  });
  onBeforeUnmount(() => {
    disconnectObserver();
    if (watchHandle) {
      watchHandle();
      watchHandle = null;
    }
  });

  /* Private */

  const updateObserver = () => {
    disconnectObserver();

    if (element.value !== null) {
      observer = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]) => {
          if (entries.length >= 1 && entries[0].isIntersecting && !revealed) {
            revealed = true;
            onShow();
          }
        },
        { root: null },
      );
      observer.observe(element.value);
    }
  };

  const disconnectObserver = () => {
    if (observer !== null) {
      observer.disconnect();
      observer = null;
    }
  };
}
