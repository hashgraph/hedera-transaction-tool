import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

export default function useCreateTooltip(
  target: Ref<HTMLElement | null>,
  html: boolean = false,
): void {
  /* State */
  let titleObserver: MutationObserver | null = null;
  let tooltip: Tooltip | null = null;

  /* Hooks */

  onMounted(() => {
    if (target.value !== null) {
      startObservingTitleChange(target.value);
    }
  });

  onBeforeUnmount(() => {
    stopObservingTitleChange();
  });

  // Handles targets that only appear after mount (e.g. behind a v-if driven by async state)
  watch(
    target,
    newTarget => {
      stopObservingTitleChange();
      if (newTarget !== null) {
        startObservingTitleChange(newTarget);
      }
    },
    { flush: 'post' },
  );

  /* Functions */
  const startObservingTitleChange = (target: HTMLElement) => {
    const titleDidChange = () => {
      tooltip?.dispose();
      tooltip = null;
      if (target.getAttribute('data-bs-toggle') == 'tooltip') {
        tooltip = new Tooltip(target, { trigger: 'hover', html: html });
      }
    };
    // https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe
    titleObserver = new MutationObserver(titleDidChange);
    titleObserver.observe(target, {
      attributeFilter: ['data-bs-toggle', 'data-bs-title'],
    });
    titleDidChange();
  };

  const stopObservingTitleChange = () => {
    tooltip?.dispose();
    tooltip = null;
    titleObserver?.disconnect();
    titleObserver = null;
  };
}
